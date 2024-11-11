'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getNumberByPercent, isItemBrandIdSameDnsId, response, settingFiles, operatorLevelList, getOperatorList, lowLevelException, getChildrenBrands } from "../utils.js/util.js";
import _ from 'lodash';
import 'dotenv/config';
import axios from "axios";
import corpApi, { getDnsData } from "../utils.js/corp-util/index.js";

const table_name = 'deposits';

const depositCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { is_mother, pay_type, s_dt, e_dt, search, is_delete, corp_account_id, is_cancel, deposit_status, is_pay_confirm } = req.query;

            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let operator_list = getOperatorList(decode_dns);

            let search_columns = [
                `users.user_name`,
                `users.nickname`,
                `${table_name}.deposit_acct_num`,
                `${table_name}.deposit_acct_name`,
                `${table_name}.trx_id`,
                `virtual_accounts.virtual_acct_num`,
                `virtual_accounts.virtual_user_name`,
                `virtual_accounts.deposit_bank_code`,
                `virtual_accounts.deposit_acct_num`,
                `virtual_accounts.deposit_acct_name`,
            ]
            let default_columns = [
                `${table_name}.id`,
                `${table_name}.is_cancel`,
                `${table_name}.created_at`,
                `${table_name}.pay_type`,
                `${table_name}.note`,
                `${table_name}.virtual_acct_num`,
                `${table_name}.virtual_acct_balance`,
                `${table_name}.amount`,
                `${table_name}.expect_amount`,
                `${table_name}.corp_account_balance`,
                `${table_name}.trx_id`,
                `${table_name}.head_office_fee`,
                `${table_name}.head_office_amount`,
                `${table_name}.mcht_fee`,
                `${table_name}.mcht_amount`,
                ...operator_list.map(oper => {
                    return [
                        `${table_name}.sales${oper.num}_id`,
                        `${table_name}.sales${oper.num}_fee`,
                        `${table_name}.sales${oper.num}_amount`,
                    ]
                }).flat(),
                `${table_name}.deposit_bank_code`,
                `${table_name}.deposit_detail`,
                `${table_name}.deposit_acct_num`,
                `${table_name}.deposit_acct_name`,
                `${table_name}.deposit_fee`,
                `${table_name}.deposit_status`,
                `${table_name}.is_pay_confirm`,
                `${table_name}.withdraw_fee`,
                `${table_name}.is_check_user`,
                `${table_name}.is_type_withdraw_acct`,
                `${table_name}.trans_date`,
                `${table_name}.trans_time`,
                `${table_name}.gift_card_code`,
            ]
            let columns = [
                ...default_columns,
                `mchts.user_name AS mcht_user_name`,
                `mchts.nickname AS mcht_nickname`,
                `mchts.brand_id AS mcht_brand_id`,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
            ]

            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            if (decode_dns?.deposit_type == 'gift_card') {
                sql += ` LEFT JOIN members ON ${table_name}.member_id=members.id `;
                columns = [
                    ...columns,
                    `members.guid AS member_guid`,
                    `members.name AS member_name`,
                    `members.phone_num AS member_phone_num`,
                ]
            } else if (decode_dns?.deposit_type == 'virtual_account') {
                sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
                columns = [
                    ...columns,
                    `CASE WHEN ${table_name}.virtual_account_id > 0  THEN virtual_accounts.virtual_bank_code ELSE ${table_name}.virtual_bank_code END AS virtual_bank_code`,
                    `CASE WHEN ${table_name}.virtual_account_id > 0  THEN virtual_accounts.virtual_acct_num ELSE ${table_name}.virtual_acct_num END AS virtual_acct_num`,
                    `CASE WHEN ${table_name}.virtual_account_id > 0  THEN virtual_accounts.virtual_acct_name ELSE ${table_name}.virtual_acct_name END AS virtual_acct_name`,
                    `virtual_accounts.birth AS virtual_birth`,
                    `virtual_accounts.created_at AS virtual_created_at`,
                    `virtual_accounts.virtual_user_name AS virtual_user_name`,
                    `virtual_accounts.deposit_bank_code AS virtual_deposit_bank_code`,
                    `virtual_accounts.deposit_acct_num AS virtual_deposit_acct_num`,
                    `virtual_accounts.deposit_acct_name AS virtual_deposit_acct_name`,
                ]
            }
            if (decode_dns?.is_use_corp_account == 1) {
                columns.push(`corp_accounts.bank_code AS corp_bank_code`)
                columns.push(`corp_accounts.acct_num AS corp_acct_num`)
                columns.push(`corp_accounts.acct_name AS corp_acct_name`)
                sql += ` LEFT JOIN corp_accounts ON ${table_name}.corp_account_id=corp_accounts.id `;
            }
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            sql += ` LEFT JOIN users AS mchts ON ${table_name}.mcht_id=mchts.id `;
            for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                if (decode_user?.level >= decode_dns?.operator_list[i]?.value) {
                    columns.push(`sales${decode_dns?.operator_list[i]?.num}.user_name AS sales${decode_dns?.operator_list[i]?.num}_user_name`);
                    columns.push(`sales${decode_dns?.operator_list[i]?.num}.nickname AS sales${decode_dns?.operator_list[i]?.num}_nickname`);
                    search_columns.push(`sales${decode_dns?.operator_list[i]?.num}.user_name`);
                    search_columns.push(`sales${decode_dns?.operator_list[i]?.num}.nickname`);
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
            if (is_cancel) {
                where_sql += ` AND ${table_name}.is_cancel=${is_cancel} `
            }
            if (deposit_status) {
                where_sql += ` AND ${table_name}.deposit_status=${deposit_status} `;
            }
            if (is_pay_confirm) {
                where_sql += ` AND ${table_name}.is_pay_confirm=${is_pay_confirm} `;
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
            let data = await getSelectQuery(sql, columns, req.query, [{
                table: 'chart',
                sql: chart_sql,
            }], decode_user, decode_dns);
            data.chart = data?.chart[0] ?? {}
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
            const decode_user = await checkLevel(req.cookies.token, 10, req);
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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                id
            } = req.body;
            let obj = {
            };


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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);

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
            const decode_user = await checkLevel(req.cookies.token, 40, req);
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
            const decode_user = await checkLevel(req.cookies.token, 40, req);
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
                        trxDay: date.replaceAll('-', ''),
                        trxTime: time.replaceAll(':', ''),
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
    cancel: async (req, res, next) => { // 입금건 취소
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            let sum_deposit_cancel = await pool.query(`SELECT SUM(amount) AS cancel_amount FROM deposits WHERE deposit_id=${id} AND is_cancel=1`);
            sum_deposit_cancel = sum_deposit_cancel?.result[0]?.cancel_amount ?? 0;
            let deposit = await selectQuerySimple(table_name, id);
            deposit = deposit?.result[0];
            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE id=${deposit?.virtual_account_id}`);
            virtual_account = virtual_account?.result[0];
            if (sum_deposit_cancel + deposit?.amount <= 0) {
                return response(req, res, -100, "이미 취소가 완료된 건입니다.", false)
            }
            let api_result = await corpApi.pay.cancel({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                tid: deposit?.trx_id,
                from_guid: dns_data?.deposit_guid,
                to_guid: virtual_account?.guid,
                amount: deposit?.amount,
            })
            if (api_result.code != 100) {
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            }

            delete deposit['id'];
            delete deposit['created_at'];
            delete deposit['updated_at'];
            delete deposit['deposit_fee'];
            deposit = {
                ...deposit,
                trx_id: (api_result.data?.tid || deposit?.trx_id),
                deposit_id: id,
                is_cancel: 1,
            }
            let keys = Object.keys(deposit);
            for (var i = 0; i < keys.length; i++) {
                if (keys[i].includes('amount')) {
                    deposit[keys[i]] = (-1) * deposit[keys[i]];
                }
            }
            let result = await insertQuery(table_name, deposit);

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default depositCtrl;
