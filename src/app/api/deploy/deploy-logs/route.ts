import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import fs from 'fs';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const host = searchParams.get('host');
        const username = searchParams.get('username');
        const password = searchParams.get('password') || undefined;
        const privateKeyPath = searchParams.get('privateKeyPath') || undefined;
        const pm2AppName = searchParams.get('pm2AppName');
        const lines = searchParams.get('lines') || '100'; 
        
        // Options: "out" (standard console logs) or "error" (runtime failures)
        const type = searchParams.get('type') || 'out'; 

        if (!host || !username || !pm2AppName) {
            return NextResponse.json(
                { error: 'Missing host, username, or pm2AppName query parameters' }, 
                { status: 400 }
            );
        }

        // Target the absolute default PM2 disk logging directories
        const logFilePath = `~/.pm2/logs/${pm2AppName}-${type}.log`;
        
        // Execute a fast tail command to pull lines directly from the remote filesystem
        const remoteScript = `tail -n ${lines} ${logFilePath}`;

        const fileLogs = await new Promise<string>((resolve, reject) => {
            const conn = new Client();

            conn.on('ready', () => {
                conn.exec(remoteScript, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject({ status: 500, error: 'File read setup failed', details: err.message });
                    }

                    let output = '';
                    let errorOutput = '';

                    stream.on('data', (data: Buffer) => { output += data.toString(); });
                    stream.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

                    stream.on('close', (code: number) => {
                        conn.end();
                        // Exit code 0 means file read succeeded; if code > 0 check if file exists
                        if (code === 0) {
                            resolve(output);
                        } else {
                            reject({ 
                                status: 404, 
                                error: 'Log file could not be read', 
                                details: errorOutput.trim() || `File ${logFilePath} may not exist yet.` 
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
                reject({ status: 400, error: 'Key file mapping error', details: fsErr.message });
            }
        });

        return NextResponse.json({ 
            success: true, 
            pm2AppName, 
            logPath: logFilePath, 
            logs: fileLogs || '[Log file is currently empty]' 
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.error || 'Internal Server Error', details: error.details || error.message },
            { status: error.status || 500 }
        );
    }
}
