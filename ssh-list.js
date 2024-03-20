import fs from 'fs';

export const ssh_list = [
    {
        host: 'your_ssh_host',
        port: 22, // 기본 포트는 22번입니다.
        username: 'your_username',
        privateKey: fs.readFileSync('C:/Users/pc/Desktop/project/virtual-account/keypair/lux/lux-pay-2.pem')
    }
]