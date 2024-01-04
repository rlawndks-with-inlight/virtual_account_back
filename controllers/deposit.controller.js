'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getNumberByPercent, isItemBrandIdSameDnsId, response, settingFiles, operatorLevelList, getOperatorList } from "../utils.js/util.js";
import _ from 'lodash';
import 'dotenv/config';

const table_name = 'deposits';

const depositCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { is_mother, pay_type } = req.query;

            let columns = [
                `${table_name}.*`,
                `virtual_accounts.virtual_bank_code`,
                `virtual_accounts.virtual_acct_num`,
                `virtual_accounts.virtual_acct_name`,
                `mchts.user_name AS mcht_user_name`,
                `mchts.nickname AS mcht_nickname`,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            sql += ` LEFT JOIN users AS mchts ON ${table_name}.mcht_id=mchts.id `;
            for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                columns.push(`sales${decode_dns?.operator_list[i]?.num}.user_name AS sales${decode_dns?.operator_list[i]?.num}_user_name`);
                columns.push(`sales${decode_dns?.operator_list[i]?.num}.nickname AS sales${decode_dns?.operator_list[i]?.num}_nickname`);
                sql += ` LEFT JOIN users AS sales${decode_dns?.operator_list[i]?.num} ON sales${decode_dns?.operator_list[i]?.num}.id=${table_name}.sales${decode_dns?.operator_list[i]?.num}_id `;
            }
            let where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            console.log(is_mother)
            if (is_mother) {
                where_sql += ` AND (${table_name}.amount > 0 OR ${table_name}.amount < 0) `
            } else {
                where_sql += ` AND ${table_name}.pay_type=0 `
            }
            if (pay_type) {
                where_sql += ` AND ${table_name}.pay_type=${pay_type} `
            }
            if (decode_user?.level < 40) {
                if (decode_user?.level == 10) {
                    where_sql += ` AND ${table_name}.mcht_id=${decode_user?.id} `;
                } else {
                    let sales_num = _.find(operatorLevelList, { level: decode_user?.level })?.num;
                    where_sql += ` AND ${table_name}.sales${sales_num}_id=${decode_user?.id} `;
                }
            }
            let operator_list = getOperatorList(decode_dns);
            for (var i = 0; i < operator_list.length; i++) {
                if (req.query[`sales${operator_list[i]?.num}_id`] > 0) {
                    where_sql += ` AND ${table_name}.sales${operator_list[i]?.num}_id=${req.query[`sales${operator_list[i]?.num}_id`]} `;
                }
            }
            if (req.query?.mcht_id > 0) {
                where_sql += ` AND ${table_name}.mcht_id=${req.query?.mcht_id} `;
            }
            sql = sql + where_sql;
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
                virtual_acct_num, amount, deposit_bank_code, deposit_acct_num, deposit_acct_name, pay_type = 0,
            } = req.body;

            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            dns_data['operator_list'] = getOperatorList(dns_data);

            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE virtual_acct_num=? `, [virtual_acct_num]);
            virtual_account = virtual_account?.result[0];
            if (!virtual_account) {
                return response(req, res, -100, "존재하지 않는 가상계좌 입니다.", false)
            }

            let mcht_columns = [
                `users.*`,
                `merchandise_columns.mcht_fee`
            ]
            for (var i = 0; i < dns_data?.operator_list.length; i++) {
                mcht_columns.push(`merchandise_columns.sales${dns_data?.operator_list[i]?.num}_id`);
                mcht_columns.push(`merchandise_columns.sales${dns_data?.operator_list[i]?.num}_fee`);
            }
            let mcht_sql = `SELECT ${mcht_columns.join()} FROM users `
            mcht_sql += ` LEFT JOIN merchandise_columns ON merchandise_columns.mcht_id=users.id `;
            mcht_sql += ` WHERE users.id=${virtual_account?.mcht_id} `;
            let mcht = await pool.query(mcht_sql);
            mcht = mcht?.result[0];
            if (!mcht) {
                return response(req, res, -100, "존재하지 않는 가맹점 입니다.", false)
            }
            let trx_id = `${new Date().getTime()}${dns_data?.id}${mcht?.id}0`;
            let obj = {
                brand_id: mcht?.brand_id,
                mcht_id: mcht?.id,
                virtual_account_id: virtual_account?.id,
                amount, deposit_bank_code, deposit_acct_num, deposit_acct_name, pay_type,
                trx_id: trx_id,
                head_office_fee: dns_data?.head_office_fee,
                deposit_fee: mcht?.deposit_fee ?? 0
            };

            let is_use_sales = false;
            let sales_depth_num = -1;
            let minus_fee = dns_data?.head_office_fee;
            for (var i = 0; i < dns_data?.operator_list.length; i++) {
                if (mcht[`sales${dns_data?.operator_list[i]?.num}_id`] > 0) {
                    is_use_sales = true;
                } else {
                    continue;
                }
                if (sales_depth_num >= 0) {
                    obj[`sales${sales_depth_num}_amount`] = getNumberByPercent(amount, mcht[`sales${dns_data?.operator_list[i]?.num}_fee`] - minus_fee)
                }
                obj[`sales${dns_data?.operator_list[i]?.num}_id`] = mcht[`sales${dns_data?.operator_list[i]?.num}_id`];
                obj[`sales${dns_data?.operator_list[i]?.num}_fee`] = mcht[`sales${dns_data?.operator_list[i]?.num}_fee`];
                minus_fee = obj[`sales${dns_data?.operator_list[i]?.num}_fee`];
                sales_depth_num = dns_data?.operator_list[i]?.num;
            }
            if (!is_use_sales) {
                return response(req, res, -100, "사용하지 않는 가맹점 입니다.", false)
            }
            obj[`sales${sales_depth_num}_amount`] = getNumberByPercent(amount, mcht[`mcht_fee`] - minus_fee);
            obj[`mcht_fee`] = mcht[`mcht_fee`];
            obj[`mcht_amount`] = getNumberByPercent(amount, 100 - mcht[`mcht_fee`]) - (mcht?.deposit_fee ?? 0);

            let result = await insertQuery(table_name, obj);
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

export default depositCtrl;
