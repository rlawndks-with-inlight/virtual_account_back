'use strict';
import { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const utilCtrl = {
    setting: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;

            let data = {};
            let deposit_api_result = await corpApi.bank.list({
                dns_data: decode_dns,
                decode_user,
                pay_type: 'deposit',
            })
            if (deposit_api_result.code != 100) {
                return response(req, res, -100, (deposit_api_result?.message || "서버 에러 발생"), false)
            }
            data['deposit'] = deposit_api_result?.data;
            let withdraw_api_result = await corpApi.bank.list({
                dns_data: decode_dns,
                decode_user,
                pay_type: 'withdraw',
            })
            if (withdraw_api_result.code != 100) {
                return response(req, res, -100, (withdraw_api_result?.message || "서버 에러 발생"), false)
            }
            data['withdraw'] = withdraw_api_result?.data;
            return response(req, res, 100, "success", data);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeStatus: async (req, res, next) => {
        try {

            const decode_user = checkLevel(req.cookies.token, 10);
            const decode_dns = checkDns(req.cookies.dns);
            const { table, column_name } = req.params;
            const { value, id } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let result = await pool.query(`UPDATE ${table} SET ${column_name}=? WHERE id=?`, [value, id]);
            return response(req, res, 100, "success", {});
        } catch (err) {
            console.log(err)
            logger.error(JSON.stringify(err?.response?.data || err))
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default utilCtrl;
