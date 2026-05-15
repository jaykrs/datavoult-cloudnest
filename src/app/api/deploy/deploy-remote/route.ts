import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import fs from 'fs';

interface SshError {
    status?: number;
    error?: string;
    details?: string;
    message?: string;
}

interface DeployRemoteRequest {
    host: string;
    username: string;
    password?: string;
    privateKeyPath?: string;
    repoUrl: string;
    branch?: string;
    port?: number;
    deployDir?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: DeployRemoteRequest = await request.json();
        const { 
            host, username, password, privateKeyPath, 
            repoUrl, branch = 'main', port = 5000, 
            deployDir = '~/deployments' 
        } = body;

        if (!host || !username || !repoUrl || (!password && !privateKeyPath)) {
            return NextResponse.json({ error: 'Missing required configuration fields' }, { status: 400 });
        }

        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'app';
        const pm2AppName = `${repoName}-${port}`;
        const uniqueFolder = `${repoName}-${Date.now()}`;
        const targetPath = `${deployDir}/${uniqueFolder}`;

        // Script updates:
        // 1. Installs pm2 globally if missing
        // 2. Clones, installs, and builds the app
        // 3. Starts/restarts the app via PM2 with custom port environment variables
        // 4. Saves PM2 state to persist through server reboots
        const remoteScript = `
            export PATH=$PATH:$HOME/.npm-global/bin:$HOME/.nvm/versions/node/$(node -v)/bin:/usr/local/bin:/usr/bin && \
            if ! command -v pm2 &> /dev/null; then npm install -g pm2; fi && \
            mkdir -p ${deployDir} && \
            git clone -b ${branch} ${repoUrl} ${targetPath} && \
            cd ${targetPath} && \
            npm install && \
            npm run build && \
            PORT=${port} pm2 start npm --name "${pm2AppName}" --update-env -- start -- --port ${port} && \
            pm2 save
        `.trim().replace(/\s+/g, ' ');

        const result = await new Promise((resolve, reject) => {
            const conn = new Client();

            conn.on('ready', () => {
                conn.exec(remoteScript, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject({ status: 500, error: 'SSH Execution setup failed', details: err.message });
                    }

                    let output = '';
                    let errorOutput = '';

                    stream.on('data', (data: Buffer) => { output += data.toString(); });
                    stream.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

                    stream.on('close', (code: number) => {
                        conn.end();
                        if (code === 0) {
                            resolve({
                                success: true,
                                message: `Application built and managed by PM2 as '${pm2AppName}'`,
                                pm2AppName,
                                targetPath,
                                runningPort: port
                            });
                        } else {
                            reject({
                                status: 500,
                                error: 'Remote PM2 deployment failed',
                                details: errorOutput || output
                            });
                        }
                    });
                });
            });

            conn.on('error', (err) => {
                reject({ status: 500, error: 'SSH Connection failed', details: err.message });
            });

            try {
                conn.connect({
                    host,
                    port: 22,
                    username,
                    password,
                    privateKey: privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined,
                });
            } catch (fsErr: any) {
                reject({ status: 400, error: 'Could not read local SSH private key file', details: fsErr.message });
            }
        });

        return NextResponse.json(result);

    } catch (error) {
        const err = error as SshError;
        return NextResponse.json(
            { error: err.error || 'Internal Server Error', details: err.details || err.message }, 
            { status: err.status || 500 }
        );
    }
}
