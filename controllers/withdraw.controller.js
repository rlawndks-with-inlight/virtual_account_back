'use strict';
import db, { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, commarNumber, isItemBrandIdSameDnsId, operatorLevelList, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'deposits';

const withdrawCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { } = req.query;

            let columns = [
                `${table_name}.*`,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            sql += ` WHERE ${table_name}.brand_id=${decode_dns?.id} AND pay_type=5 `;
            if (decode_user?.level < 40) {
                if (decode_user?.level == 10) {
                    sql += ` AND ${table_name}.mcht_id=${decode_user?.id} `;
                } else {
                    let sales_num = _.find(operatorLevelList, { level: decode_user?.level })?.num;
                    sql += ` AND ${table_name}.sales${sales_num}_id=${decode_user?.id} `;
                }
            }
            let data = await getSelectQuery(sql, columns, req.query);

            return response(req, res, 100, "success", data);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    get: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            let data = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`)
            data = data?.result[0];
            if (!isItemBrandIdSameDnsId(decode_dns, data)) {
                return lowLevelException(req, res);
            }
            return response(req, res, 100, "success", data)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    create: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                withdraw_amount, user_id, pay_type = 5
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
                withdraw_amount, user_id, pay_type
            };

            obj = { ...obj, ...files };



            let user_column = [
                `users.*`,
            ]
            let user = await pool.query(`SELECT ${user_column.join()} FROM users WHERE id=${user_id}`);
            user = user?.result[0];

            let amount = parseInt(withdraw_amount) + user?.withdraw_fee;


            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                expect_amount: (-1) * amount,
                settle_bank_code: user?.settle_bank_code,
                settle_acct_num: user?.settle_acct_num,
                settle_acct_name: user?.settle_acct_name,
                withdraw_fee: user?.withdraw_fee,
                user_id: user?.id,
                withdraw_status: 5,
            }

            let settle_amount_sql = ``;
            if (user?.level == 10) {
                settle_amount_sql = `SELECT SUM(mcht_amount) AS settle_amount FROM deposits WHERE mcht_id=${user?.id}`;
                deposit_obj[`mcht_id`] = user?.id
                deposit_obj[`mcht_amount`] = (-1) * amount;
            } else {
                let find_oper_level = _.find(operatorLevelList, { level: parseInt(user?.level) });
                settle_amount_sql = `SELECT SUM(sales${find_oper_level.num}_amount) AS settle_amount FROM deposits WHERE sales${find_oper_level.num}_id=${user?.id}`;
                deposit_obj[`sales${find_oper_level.num}_id`] = user?.id
                deposit_obj[`sales${find_oper_level.num}_amount`] = (-1) * amount;
            }
            let settle_amount = await pool.query(settle_amount_sql);
            settle_amount = settle_amount?.result[0]?.settle_amount ?? 0;
            if (amount > settle_amount) {
                return response(req, res, -100, "출금 요청금이 보유정산금보다 많습니다.", false)
            }
            if (settle_amount < user?.min_withdraw_remain_price) {
                return response(req, res, -100, `최소 정산출금잔액은 ${commarNumber(user?.min_withdraw_remain_price)}원 입니다.`, false)
            }
            if (parseInt(withdraw_amount) < user?.min_withdraw_price) {
                return response(req, res, -100, `최소 정산 출금액은 ${commarNumber(user?.min_withdraw_price)}원 입니다.`, false)
            }

            let api_move_to_user_amount_result = await corpApi.transfer.pass({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user: user,
                from_guid: dns_data[`deposit_guid`],
                to_guid: user?.guid,
                amount: withdraw_amount,
            })

            if (api_move_to_user_amount_result.code != 100) {
                return response(req, res, -100, (api_move_to_user_amount_result?.message || "서버 에러 발생"), api_move_to_user_amount_result?.data)
            }
            let api_withdraw_request_result = await corpApi.user.withdraw.request({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user: user,
                guid: user?.guid,
                amount: withdraw_amount,
            })
            console.log(api_withdraw_request_result);
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }

            let result = await insertQuery(`${table_name}`, deposit_obj);

            /*
            let trx_id = `${new Date().getTime()}${decode_dns?.id}${user?.id}5`;
            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                amount: (-1) * (parseInt(withdraw_amount) + user?.withdraw_fee),
                settle_bank_code: user?.settle_bank_code,
                settle_acct_num: user?.settle_acct_num,
                settle_acct_name: user?.settle_acct_name,
                trx_id: trx_id,
                withdraw_fee: user?.withdraw_fee,
                user_id: user?.id,
            }

           
*/
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    update: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                id
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
            };
            obj = { ...obj, ...files };

            let result = await updateQuery(`${table_name}`, obj, id);

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    remove: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            let result = await deleteQuery(`${table_name}`, {
                id
            })
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default withdrawCtrl;
