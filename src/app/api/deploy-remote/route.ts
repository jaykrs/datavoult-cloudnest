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
    privateKeyPath?: string; // Server path or local server absolute path to .pem file
    repoUrl: string;         // e.g., "https://github.com"
    branch?: string;         // e.g., "main"
    port?: number;           // e.g., 5000
    deployDir?: string;      // Target folder on remote machine e.g., "/var/www/apps"
}

export async function POST(request: NextRequest) {
    try {
        const body: DeployRemoteRequest = await request.json();
        const { 
            host, username, password, privateKeyPath, 
            repoUrl, branch = 'main', port = 5000, 
            deployDir = '~/deployments' 
        } = body;

        // Validation
        if (!host || !username || !repoUrl || (!password && !privateKeyPath)) {
            return NextResponse.json({ error: 'Missing required configuration fields' }, { status: 400 });
        }

        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'app';
        const uniqueFolder = `${repoName}-${Date.now()}`;
        const targetPath = `${deployDir}/${uniqueFolder}`;

        // Chained remote setup command:
        // 1. Ensures base path structure exists
        // 2. Clones the project branch
        // 3. Installs dependencies and builds assets
        // 4. Starts application in the background using nohup to prevent process termination on SSH exit
        const remoteScript = `
            mkdir -p ${deployDir} && \
            git clone -b ${branch} ${repoUrl} ${targetPath} && \
            cd ${targetPath} && \
            npm install && \
            npm run build && \
            PORT=${port} nohup npm start > app.log 2>&1 &
        `.trim().replace(/\s+/g, ' ');

        // Execute commands via SSH
        const result = await new Promise((resolve, reject) => {
            const conn = new Client();

            conn.on('ready', () => {
                conn.exec(remoteScript, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject({ status: 500, error: 'SSH Command initialization failed', details: err.message });
                    }

                    let output = '';
                    let errorOutput = '';

                    stream.on('data', (data: Buffer) => { output += data.toString(); });
                    stream.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

                    stream.on('close', (code: number) => {
                        conn.end();
                        // Exit code 0 means everything up to building succeeded and the background command was fired
                        if (code === 0) {
                            resolve({
                                success: true,
                                message: 'Deployment sequence executed successfully on remote server.',
                                targetPath,
                                runningPort: port,
                                logFile: `${targetPath}/app.log`
                            });
                        } else {
                            reject({
                                status: 500,
                                error: 'Remote build sequence failed',
                                details: errorOutput || output
                            });
                        }
                    });
                });
            });

            conn.on('error', (err) => {
                reject({ status: 500, error: 'SSH Connection failed', details: err.message });
            });

            // Handle connection configurations
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
            { 
                error: err.error || 'Internal Server Error', 
                details: err.details || err.message 
            }, 
            { status: err.status || 500 }
        );
    }
}
