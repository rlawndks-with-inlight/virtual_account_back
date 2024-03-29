'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getNumberByPercent, isItemBrandIdSameDnsId, response, settingFiles, operatorLevelList, getOperatorList, lowLevelException, getChildrenBrands } from "../utils.js/util.js";
import _ from 'lodash';
import 'dotenv/config';
import axios from "axios";
import { getDnsData } from "../utils.js/corp-util/index.js";

const table_name = 'deposits';

const depositCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 10);
            const decode_dns = checkDns(req.cookies.dns);
            const { is_mother, pay_type, s_dt, e_dt, search, is_delete, corp_account_id } = req.query;

            if (!decode_user) {
                return lowLevelException(req, res);
            }

            let search_columns = [
                `users.user_name`,
                `users.nickname`,
                `${table_name}.deposit_acct_num`,
                `${table_name}.deposit_acct_name`,
                `virtual_accounts.virtual_acct_num`,
                `virtual_accounts.virtual_user_name`,
            ]
            let columns = [
                `${table_name}.*`,
                `CASE WHEN ${table_name}.virtual_account_id > 0  THEN virtual_accounts.virtual_bank_code ELSE ${table_name}.virtual_bank_code END AS virtual_bank_code`,
                `CASE WHEN ${table_name}.virtual_account_id > 0  THEN virtual_accounts.virtual_acct_num ELSE ${table_name}.virtual_acct_num END AS virtual_acct_num`,
                `CASE WHEN ${table_name}.virtual_account_id > 0  THEN virtual_accounts.virtual_acct_name ELSE ${table_name}.virtual_acct_name END AS virtual_acct_name`,
                `virtual_accounts.birth AS virtual_birth`,
                `virtual_accounts.created_at AS virtual_created_at`,
                `virtual_accounts.virtual_user_name AS virtual_user_name`,
                `corp_accounts.bank_code AS corp_bank_code`,
                `corp_accounts.acct_num AS corp_acct_num`,
                `corp_accounts.acct_name AS corp_acct_name`,
                `mchts.user_name AS mcht_user_name`,
                `mchts.nickname AS mcht_nickname`,
                `mchts.brand_id AS mcht_brand_id`,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
            ]

            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
            sql += ` LEFT JOIN corp_accounts ON ${table_name}.corp_account_id=corp_accounts.id `;
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            sql += ` LEFT JOIN users AS mchts ON ${table_name}.mcht_id=mchts.id `;
            for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                if (decode_user?.level >= decode_dns?.operator_list[i]?.value) {
                    columns.push(`sales${decode_dns?.operator_list[i]?.num}.user_name AS sales${decode_dns?.operator_list[i]?.num}_user_name`);
                    columns.push(`sales${decode_dns?.operator_list[i]?.num}.nickname AS sales${decode_dns?.operator_list[i]?.num}_nickname`);
                    sql += ` LEFT JOIN users AS sales${decode_dns?.operator_list[i]?.num} ON sales${decode_dns?.operator_list[i]?.num}.id=${table_name}.sales${decode_dns?.operator_list[i]?.num}_id `;
                }
            }
            let where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            if (is_mother) {
                where_sql += ` AND (${table_name}.amount > 0 OR ${table_name}.amount < 0) `
            } else {
                where_sql += ` AND ${table_name}.pay_type=0 `
            }
            if (pay_type) {
                where_sql += ` AND ${table_name}.pay_type=${pay_type} `
            }
            if (corp_account_id) {
                if (corp_account_id == -1) {
                    where_sql += ` AND (${table_name}.corp_account_id IS NULL OR ${table_name}.corp_account_id=0) `
                } else if (corp_account_id > 0) {
                    where_sql += ` AND ${table_name}.corp_account_id=${corp_account_id} `
                }
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
            if (search) {
                where_sql += makeSearchQuery(search_columns, search);
            }
            sql = sql + where_sql;

            let chart_columns = [
                `SUM(${table_name}.expect_amount) AS expect_amount`,
                `SUM(${table_name}.amount) AS amount`,
                `SUM(${table_name}.mcht_amount) AS mcht_amount`,
                `SUM(${table_name}.head_office_amount) AS head_office_amount`,
                `SUM(${table_name}.top_office_amount) AS top_office_amount`,
                `SUM(${table_name}.deposit_fee) AS deposit_fee`,
            ]
            for (var i = 0; i < operator_list.length; i++) {
                chart_columns.push(`SUM(${table_name}.sales${operator_list[i]?.num}_amount) AS sales${operator_list[i]?.num}_amount`)
            }
            let chart_sql = sql;
            if (s_dt) {
                chart_sql += ` AND ${table_name}.created_at >= '${s_dt} 00:00:00' `;
            }
            if (e_dt) {
                chart_sql += ` AND ${table_name}.created_at <= '${e_dt} 23:59:59' `;
            }
            chart_sql = chart_sql.replaceAll(process.env.SELECT_COLUMN_SECRET, chart_columns.join());
            let chart_data = await pool.query(chart_sql);
            chart_data = chart_data?.result[0];
            let data = await getSelectQuery(sql, columns, req.query);

            return response(req, res, 100, "success", { ...data, chart: chart_data });
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    get: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 10);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
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
                mid, amount, deposit_bank_code, deposit_acct_num, deposit_acct_name
            } = req.body;

            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            dns_data['operator_list'] = getOperatorList(dns_data);
            let mcht = await pool.query(`SELECT * FROM users WHERE mid=? AND level=10`, [mid]);
            mcht = mcht?.result[0];

            let obj = {
                brand_id: dns_data?.id,
                expect_amount: amount,
                deposit_bank_code,
                deposit_acct_num,
                deposit_acct_name,
                mcht_id: mcht?.id,
                deposit_fee: mcht?.deposit_fee,
            };

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
    changeNote: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 40);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                deposit_id, note,
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let result = await updateQuery(`${table_name}`, {
                note
            }, deposit_id)
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    addNotiDeposit: async (req, res, next) => { // 노티 누락건 추가
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 40);
            const decode_dns = checkDns(req.cookies.dns);
            if (!(((decode_user?.level >= 40 && !(decode_dns?.parent_id > 0)) || decode_user?.level >= 45) && [1, 3, 6].includes(decode_dns?.deposit_corp_type))) {
                return lowLevelException(req, res);
            }
            const {
                guid,
                trx_id,
                amount,
                date,
                time
            } = req.body;
            if (!trx_id || !amount || !guid) {
                return response(req, res, -100, "필수값을 입력해 주세요.", false)
            }
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let dns_data = await getDnsData(decode_dns);

            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE guid=? AND brand_id=?`, [
                guid,
                decode_dns?.id,
            ])
            virtual_account = virtual_account?.result[0];
            if (!virtual_account) {
                return response(req, res, -100, "존재하지 않는 가상계좌 guid 입니다.", false)
            }
            if (decode_dns?.deposit_corp_type == 1) {//뱅크너스
                let { data: response } = await axios.post(`${process.env.API_URL}/api/push/deposit`, {
                    trx_amt: amount,
                    guid: virtual_account?.guid,
                    tid: trx_id,
                })
                if (response != '0000') {
                    return response(req, res, -100, "노티서버 문제", false)
                }
            } else if (decode_dns?.deposit_corp_type == 3) {//페이투스

            } else if (decode_dns?.deposit_corp_type == 6) {//코리아
                let top_amount = getNumberByPercent(amount, dns_data?.head_office_fee)
                let { data: response } = await axios.post(`${process.env.API_URL}/api/push/korea-pay-system/deposit`, {
                    response: {
                        vactId: trx_id,
                        mchtId: dns_data?.deposit_api_id,
                        issueId: virtual_account?.tid,
                        sender: virtual_account?.deposit_acct_name,
                        amount: amount,
                        trxType: 'deposit',
                        trxDay: date,
                        trxTime: time,
                        trackId: virtual_account?.guid,
                        stlFee: top_amount,
                        stlFeeVat: 0,
                        resultMsg: "",
                    }
                });
                if (response != '0000') {
                    return response(req, res, -100, "노티서버 문제", false)
                }
            }
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default depositCtrl;
