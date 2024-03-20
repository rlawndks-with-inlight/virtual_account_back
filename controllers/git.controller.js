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
                const sshClient = new Client();
            }
            console.log(1)
            return response(req, res, 100, "success", {});
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};


export default gitCtrl;
