'use strict';
import { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'members';

const memberCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { status, mcht_id } = req.query;

            let columns = [
                `${table_name}.*`,
                `mchts.user_name`,
                `mchts.nickname`,
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users AS mchts ON ${table_name}.mcht_id=mchts.id `;
            sql += ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            if (mcht_id > 0 || decode_user?.level == 10) {
                sql += ` AND ${table_name}.mcht_id=${mcht_id || decode_user?.id} `;
            }
            if (status) {
                sql += ` AND ${table_name}.status=${status} `
            }
            let data = await getSelectQuery(sql, columns, req.query, [], decode_user, decode_dns);

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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            const { ci } = req.query;
            let values = [];
            let sql = ` SELECT ${table_name}.*, users.mid FROM ${table_name} `;
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            if (id > 0) {
                sql += ` WHERE ${table_name}.id=? `;
                values.push(id)
            } else if (ci) {
                sql += ` WHERE ${table_name}.ci=? `;
                values.push(ci)
            }
            sql += ` AND ${table_name}.brand_id=${decode_dns?.id} `;
            console.log(sql)
            let data = await pool.query(sql, values)
            data = data?.result[0];
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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
                brand_id, name, note, price, category_id
            };

            obj = { ...obj, ...files };

            let result = await insertQuery(`${table_name}`, obj);

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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
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
    getBalance: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            const { want_move } = req.query;
            console.log(req.query)
            let member = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            member = member?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let user_amount = await corpApi.balance.info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: member?.guid,
            })
            let amount = user_amount.data?.amount ?? 0

            return response(req, res, 100, "success", {
                amount
            })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    getStatus: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            let member = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            member = member?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let api_result = await corpApi.vaccount_info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: member?.guid,
            })
            console.log(api_result)
            let status = (api_result.data?.virtual_acct_num == member?.virtual_acct_num && api_result.data?.status == 0) ? 0 : 1;
            return response(req, res, 100, "success", {
                status
            })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    moveMother: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.body;
            let member = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            member = member?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let user_amount = await corpApi.balance.info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: member?.guid,
            })
            let amount = user_amount.data?.amount ?? 0
            if (amount > 0) {
                let mother_to_result = await corpApi.transfer.pass({
                    pay_type: 'deposit',
                    dns_data,
                    decode_user,
                    from_guid: member?.guid,
                    to_guid: dns_data[`deposit_guid`],
                    amount: amount,
                })
                let obj = {
                    brand_id: decode_dns?.id,
                    member_id: member?.id,
                    amount,
                    expect_amount: amount,
                    pay_type: 15,
                    trx_id: mother_to_result.data?.tid,
                };
                let result = await insertQuery(`deposits`, obj);
            }
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    remove: async (req, res, next) => {
        try {
            const decode_user = await checkLevel(req.cookies?.token, 10, req);
            let decode_dns = checkDns(req.cookies?.dns);
            if (!decode_dns) {
                decode_dns = req.dns_data;
            }
            const { id } = req.params;
            let member = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            member = member?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            if (member?.mcht_id != decode_user?.id && decode_user?.level < 40) {
                return lowLevelException(req, res);
            }
            let user_amount = await corpApi.balance.info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: member?.guid,
            })
            let amount = user_amount.data?.amount ?? 0
            if (amount > 0 && dns_data?.withdraw_corp_type != 7) {
                let mother_to_result = await corpApi.transfer.pass({
                    pay_type: 'deposit',
                    dns_data,
                    decode_user,
                    from_guid: member?.guid,
                    to_guid: dns_data[`deposit_guid`],
                    amount: amount,
                })
                let obj = {
                    brand_id: decode_dns?.id,
                    member_id: member?.id,
                    amount,
                    expect_amount: amount,
                    pay_type: 15,
                    trx_id: mother_to_result.data?.tid ?? "",
                };
                let result = await insertQuery(`deposits`, obj);
                console.log('1:' + mother_to_result);
            }

            // if (api_result.code != 100 && api_result?.message != '가상계좌 해지 불가 상태') {
            //     return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            // }
            if (member?.deposit_acct_num && member?.delete_step < 2) {
                await new Promise((r) => setTimeout(r, 1000));
                let api_result_account_delete = await corpApi.user.account_delete({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    guid: member?.guid,
                    bank_id: member?.deposit_bank_code,
                    deposit_acct_num: member?.deposit_acct_num,
                })
                console.log('2:' + api_result_account_delete);
                if (api_result_account_delete?.code != 100) {
                    return response(req, res, -100, (api_result_account_delete?.message || "서버 에러 발생"), false)
                }
                let result = await updateQuery(`${table_name}`, {
                    delete_step: 2,
                }, id)
            }

            // if (api_result.code != 100 && api_result.message != '출금계좌 불일치로 진행 불가') {
            //     return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            // }
            if (member?.guid && member?.delete_step < 3) {
                await new Promise((r) => setTimeout(r, 1000));
                let delete_user = await corpApi.user.remove({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    guid: member?.guid,
                })
                console.log('3:' + delete_user);
                // if (delete_user?.code != 100) {
                //     return response(req, res, -100, (delete_user?.message || "서버 에러 발생"), false)
                // }
                let result = await updateQuery(`${table_name}`, {
                    delete_step: 3,
                }, id)
            }

            let result1 = await updateQuery(`users`, {
                member_id: null,
            }, id, 'member_id')
            let result2 = await updateQuery(`brands`, {
                member_id: null,
            }, id, 'member_id')
            let result3 = await deleteQuery(`${table_name}`, {
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

export default memberCtrl;
