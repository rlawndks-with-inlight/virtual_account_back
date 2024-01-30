'use strict';
import axios from "axios";
import db, { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'virtual_accounts';

const virtualAccountCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { mcht_id, status, search } = req.query;
            let search_columns = [
                `mchts.user_name`,
                `mchts.nickname`,
                `${table_name}.deposit_acct_num`,
                `${table_name}.deposit_acct_name`,
                `${table_name}.guid`,
            ]
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
            if (search) {
                sql += makeSearchQuery(search_columns, search);
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
            let data = await pool.query(sql, values)
            data = data?.result[0];
            console.log(data)
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
                mid, tid, guid,
                vrf_word
            } = req.body;
            let files = settingFiles(req.files);

            let { data: result } = await axios.post(`${process.env.API_URL}/api/virtual-account/check`, {
                mid,
                tid,
                vrf_word,
                guid
            })
            if (result?.result > 0) {
                return response(req, res, 100, "success", result?.data)
            } else {
                return response(req, res, result?.result, result?.message, {})
            }
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
    getBalance: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            let virtual_account = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            virtual_account = virtual_account?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let user_amount = await corpApi.balance.info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
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
    remove: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            let virtual_account = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            virtual_account = virtual_account?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let user_amount = await corpApi.balance.info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
            })
            let amount = user_amount.data?.amount ?? 0
            if (amount > 0) {
                let mother_to_result = await corpApi.transfer.pass({
                    pay_type: 'deposit',
                    dns_data,
                    decode_user,
                    from_guid: virtual_account?.guid,
                    to_guid: dns_data[`deposit_guid`],
                    amount: amount,
                })
                let obj = {
                    brand_id: decode_dns?.id,
                    virtual_account_id: virtual_account?.id,
                    amount,
                    expect_amount: amount,
                    deposit_bank_code: virtual_account?.deposit_bank_code,
                    deposit_acct_num: virtual_account?.deposit_acct_num,
                    deposit_acct_name: virtual_account?.deposit_acct_name,
                    pay_type: 15,
                    trx_id: mother_to_result.data?.tid,
                };
                let result = await insertQuery(`deposits`, obj);
            }
            if (virtual_account?.status == 0) {
                let api_result = await corpApi.vaccount_delete({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    guid: virtual_account?.guid,
                    bank_id: virtual_account?.virtual_bank_code,
                    virtual_acct_num: virtual_account?.virtual_acct_num,
                })
                console.log(api_result)
                // if (api_result.code != 100 && api_result?.message != '가상계좌 해지 불가 상태') {
                //     return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
                // }
            }
            if (virtual_account?.deposit_acct_num) {
                let api_result = await corpApi.user.account_delete({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    guid: virtual_account?.guid,
                    bank_id: virtual_account?.deposit_bank_code,
                    deposit_acct_num: virtual_account?.deposit_acct_num,
                })
                console.log(api_result)
                // if (api_result.code != 100 && api_result.message != '출금계좌 불일치로 진행 불가') {
                //     return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
                // }
            }
            let delete_user = await corpApi.user.remove({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
            })
            console.log(delete_user)
            let result1 = await updateQuery(`users`, {
                virtual_account_id: 0,
            }, id, 'virtual_account_id')
            let result2 = await updateQuery(`brands`, {
                virtual_account_id: 0,
            }, id, 'virtual_account_id')
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

export default virtualAccountCtrl;
