'use strict';
import _ from "lodash";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import { Client } from "ssh2";
import { ssh_list } from "../ssh-list.js";

const gitCtrl = {
    commit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 50);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            for (var i = 0; i < ssh_list.length; i++) {
                execSSH(ssh_list[i]);
            }
            return response(req, res, 100, "success", {});
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};
const execSSH = (ssh_obj_ = {}) => {
    let ssh_obj = {
        host: ssh_obj_?.host,
        port: ssh_obj_?.port, // 기본 포트는 22번입니다.
        username: ssh_obj_?.username,
        dns: ssh_obj_?.dns,
    }
    if (ssh_obj_?.key_type == 'pem') {
        ssh_obj['privateKey'] = ssh_obj_?.privateKey;
    } else if (ssh_obj_?.key_type == 'password') {
        ssh_obj['password'] = ssh_obj_?.password;
    }
    const conn = new Client();
    conn.on('ready', () => {
        console.log('Client :: ready');
        conn.exec('cd front && git pull origin master && npm run deploy', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                console.log(ssh_obj?.dns)
                conn.end();
            }).on('data', (data) => {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', (data) => {
                console.log('STDERR: ' + data);
            });
        });
    }).connect(ssh_obj);
}

export default gitCtrl;
