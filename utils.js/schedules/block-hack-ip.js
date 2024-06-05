import { getFileLogs } from "../../controllers/log.controller.js";
import { returnMoment } from "../function.js";
import { execSSH } from "../ssh.js";

export const blockHackIp = async () => {
    try {
        let noti_logs = await getFileLogs(
            'noti',
            {
                response_result_type: 2,
                dt: returnMoment().substring(0, 10),
                page_size: 100000,
            },
            {},
            {
                is_main_dns: 1,
            }
        );
        noti_logs = noti_logs?.content;
        let ip_obj = {};
        for (var i = 0; i < noti_logs.length; i++) {
            if (noti_logs[i]?.response_result == '3333') {
                if (!ip_obj[noti_logs[i]?.request_ip]) {
                    ip_obj[noti_logs[i]?.request_ip] = 0;
                }
                let request = JSON.parse(noti_logs[i]?.request ?? '{}');
                if (request?.url != '/favicon.ico') {
                    ip_obj[noti_logs[i]?.request_ip]++;
                }
            }
        }
        let keys = Object.keys(ip_obj);
        for (var i = 0; i < keys.length; i++) {
            if (ip_obj[keys[i]] >= 5) {
                execSSH(`route add -host ${keys[i]} reject`);
            }
        }
    } catch (err) {
        console.log(err);
    }
}
