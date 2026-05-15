import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import fs from 'fs';

// 1. Define custom error interface for our SSH Promise rejection
interface SshError {
    status?: number;
    error?: string;
    details?: string;
    stderr?: string;
    exitCode?: number;
    message?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { host, username, password, privateKey, packageName } = body;

        if (!host || !username || !packageName || (!password && !privateKey)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await new Promise((resolve, reject) => {
            const conn = new Client();

            conn.on('ready', () => {
                const command = `sudo yum install -y ${packageName}`;

                conn.exec(command, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject({ status: 500, error: 'Command execution failed', details: err.message });
                    }

                    let output = '';
                    let errorOutput = '';

                    stream.on('data', (data: Buffer) => {
                        output += data.toString();
                    });

                    stream.stderr.on('data', (data: Buffer) => {
                        errorOutput += data.toString();
                    });

                    stream.on('close', (code: number) => {
                        conn.end();
                        if (code === 0) {
                            resolve({ success: true, message: `Package '${packageName}' installed`, output });
                        } else {
                            reject({ status: 500, error: 'Installation failed', exitCode: code, stderr: errorOutput });
                        }
                    });
                });
            });

            conn.on('error', (err) => {
                reject({ status: 500, error: 'SSH Connection error', details: err.message });
            });

            try {
                conn.connect({
                    host,
                    port: 22,
                    username,
                    password,
                    privateKey: privateKey ? fs.readFileSync(privateKey) : undefined,
                });
            } catch (fsErr: any) {
                reject({ status: 400, error: 'Failed to read private key file', details: fsErr.message });
            }
        });

        return NextResponse.json(result);

    } catch (error) {
        // 2. Cast the unknown error to our specific SshError interface
        const err = error as SshError;
        
        const status = err.status || 500;
        return NextResponse.json(
            { 
                error: err.error || 'Internal Server Error', 
                details: err.details || err.message,
                stderr: err.stderr || undefined,
                exitCode: err.exitCode || undefined
            }, 
            { status }
        );
    }
}
