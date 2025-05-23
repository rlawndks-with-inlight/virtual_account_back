'use strict';
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getMultipleQueryByWhen, getSelectQuery, insertMultyQuery, insertQuery, insertQueryMultiRow, makeSearchQuery, makeSearchQueryExact, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getNumberByPercent, isItemBrandIdSameDnsId, response, settingFiles, operatorLevelList, getOperatorList, lowLevelException, getChildrenBrands } from "../utils.js/util.js";
import _ from 'lodash';
import 'dotenv/config';
import axios from "axios";
import corpApi, { getDnsData } from "../utils.js/corp-util/index.js";
import { readPool, writePool } from "../config/db-pool.js";
import redisCtrl from "../redis/index.js";

const table_name = 'deposits';

const depositCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                is_mother,
                pay_type,
                s_dt, e_dt,
                search,
                is_asc,
                page,
                page_size,
                is_delete, corp_account_id, virtual_account_id, is_cancel, deposit_status, is_pay_confirm
            } = req.query;
            if ([10, 20, 30, 50, 100].includes(page_size)) {
                return response(req, res, -100, "페이지 크기가 잘못되었습니다.", false)
            }
            if (!s_dt) {
                return response(req, res, -100, "시작일을 선택해 주세요.", false)
            }
            if (!e_dt) {
                return response(req, res, -100, "종료일을 선택해 주세요.", false)
            }
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let operator_list = getOperatorList(decode_dns);

            let search_columns = [
                /*
                `users.user_name`,
                `users.nickname`, 
                */
                `${table_name}.deposit_acct_num`,
                `${table_name}.deposit_acct_name`,
                `${table_name}.trx_id`,
                `virtual_accounts.virtual_acct_num`,
                `virtual_accounts.virtual_user_name`,
                `virtual_accounts.deposit_acct_name`,
                /*
                `virtual_accounts.deposit_bank_code`,
                `virtual_accounts.deposit_acct_num`,
                `virtual_accounts.deposit_acct_name`,  
                */
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
                `${table_name}.is_delete`,
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
            let join_sql = ``;
            if (decode_dns?.deposit_type == 'gift_card') {
                join_sql += ` LEFT JOIN members ON ${table_name}.member_id=members.id `;
                columns = [
                    ...columns,
                    `members.guid AS member_guid`,
                    `members.name AS member_name`,
                    `members.phone_num AS member_phone_num`,
                ]
            } else if (decode_dns?.deposit_type == 'virtual_account') {
                join_sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
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
                join_sql += ` LEFT JOIN corp_accounts ON ${table_name}.corp_account_id=corp_accounts.id `;
            }
            join_sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            join_sql += ` LEFT JOIN users AS mchts ON ${table_name}.mcht_id=mchts.id `;
            let is_chart_use_join = false;
            for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                if (decode_user?.level >= decode_dns?.operator_list[i]?.value) {
                    columns.push(`sales${decode_dns?.operator_list[i]?.num}.user_name AS sales${decode_dns?.operator_list[i]?.num}_user_name`);
                    columns.push(`sales${decode_dns?.operator_list[i]?.num}.nickname AS sales${decode_dns?.operator_list[i]?.num}_nickname`);
                    search_columns.push(`sales${decode_dns?.operator_list[i]?.num}.user_name`);
                    search_columns.push(`sales${decode_dns?.operator_list[i]?.num}.nickname`);
                    join_sql += ` LEFT JOIN users AS sales${decode_dns?.operator_list[i]?.num} ON sales${decode_dns?.operator_list[i]?.num}.id=${table_name}.sales${decode_dns?.operator_list[i]?.num}_id `;
                }
            }

            let where_sql = ` `;
            let brand_where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id}  `;
            if (s_dt == e_dt && s_dt == returnMoment().substring(0, 10)) {
                where_sql += ` AND ${table_name}.created_at >= CURDATE() `;
            } else {
                if (s_dt) {
                    where_sql += ` AND ${table_name}.created_at >= '${s_dt} 00:00:00' `;
                }
                if (e_dt && e_dt < returnMoment().substring(0, 10)) {
                    where_sql += ` AND ${table_name}.created_at <= '${e_dt} 23:59:59' `;
                }
            }
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
                    brand_where_sql = ` WHERE 1=1 `;
                } else {
                    let sales_num = _.find(operatorLevelList, { level: decode_user?.level })?.num;
                    where_sql += ` AND ${table_name}.sales${sales_num}_id=${decode_user?.id} `;
                    brand_where_sql = ` WHERE 1=1 `;
                }
            } else {
                if (req.query?.mcht_id > 0) {
                    where_sql += ` AND ${table_name}.mcht_id=${req.query?.mcht_id} `;
                    brand_where_sql = ` WHERE 1=1 `;
                }
                for (var i = 0; i < operator_list.length; i++) {
                    if (req.query[`sales${operator_list[i]?.num}_id`] > 0) {
                        where_sql += ` AND ${table_name}.sales${operator_list[i]?.num}_id=${req.query[`sales${operator_list[i]?.num}_id`]} `;
                        brand_where_sql = ` WHERE 1=1 `;
                    }
                }
            }
            where_sql = brand_where_sql + where_sql;
            if (is_cancel) {
                where_sql += ` AND ${table_name}.is_cancel=${is_cancel} `
            }
            if (is_delete) {
                where_sql += ` AND ${table_name}.is_delete=${is_delete} `
            } else {
                //where_sql += ` AND ${table_name}.is_delete=0 `
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
            if (virtual_account_id) {
                where_sql += ` AND ${table_name}.virtual_account_id=${virtual_account_id} `
            }

            if (search) {
                where_sql += makeSearchQueryExact(search_columns, search);
                is_chart_use_join = true;
            }
            let chart_columns = [
                `COUNT(*) AS total`,
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
            let chart_sql = sql + (is_chart_use_join ? join_sql : '') + where_sql;
            chart_sql = chart_sql.replaceAll(process.env.SELECT_COLUMN_SECRET, chart_columns.join());

            sql = sql + join_sql + where_sql;
            sql += ` ORDER BY ${table_name}.id ${is_asc ? 'ASC' : 'DESC'} `;

            sql = sql.replaceAll(process.env.SELECT_COLUMN_SECRET, columns.join());
            let data = {};

            let chart = await redisCtrl.get(`deposit_chart_${decode_user?.id}`);
            let is_redis_chart_where_sql = await redisCtrl.get(`deposit_chart_where_sql_${decode_user?.id}`);
            if (is_redis_chart_where_sql == where_sql && chart) {
                chart = JSON.parse(chart);
            } else {
                chart = await readPool.query(chart_sql);
                chart = chart[0][0];
                await redisCtrl.set(`deposit_chart_where_sql_${decode_user?.id}`, where_sql, 30);
                await redisCtrl.set(`deposit_chart_${decode_user?.id}`, JSON.stringify(chart), 30);
            }

            if (chart?.total >= 1 * page_size) {
                sql += ` LIMIT ${(page - 1) * page_size}, ${page_size} `;
            }

            let content = await readPool.query(sql);
            content = content[0];
            data = {
                content,
                chart,
            }
            /*
            let data = await getSelectQuery(sql, columns, req.query, [{
                table: 'chart',
                sql: chart_sql,
            }], decode_user, decode_dns, true);
            */
            for (var i = 0; i < data.content.length; i++) {
                let keys = Object.keys(data.content[i]);
                for (var j = 0; j < keys.length; j++) {
                    if (keys[j].includes('d_at')) {
                        data.content[i][keys[j]] = returnMoment(data.content[i][keys[j]])
                    }
                }
            }
            data = {
                ...data,
                total: data.chart?.total,
                page,
                page_size,
            }
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
            let data = await readPool.query(`SELECT * FROM ${table_name} WHERE id=${id}`)
            data = data[0][0];
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

            let dns_data = await readPool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data[0][0];
            dns_data['operator_list'] = getOperatorList(dns_data);
            let mcht = await readPool.query(`SELECT * FROM users WHERE mid=? AND level=10`, [mid]);
            mcht = mcht[0][0];

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

            let virtual_account = await readPool.query(`SELECT * FROM virtual_accounts WHERE guid=? AND brand_id=?`, [
                guid,
                decode_dns?.id,
            ])
            virtual_account = virtual_account[0][0];
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
            let dns_data = await readPool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data[0][0];
            let sum_deposit_cancel = await readPool.query(`SELECT SUM(amount) AS cancel_amount FROM deposits WHERE deposit_id=${id} AND is_cancel=1`);
            sum_deposit_cancel = sum_deposit_cancel[0][0]?.cancel_amount ?? 0;
            let deposit = await selectQuerySimple(table_name, id);
            deposit = deposit[0];
            let virtual_account = await readPool.query(`SELECT * FROM virtual_accounts WHERE id=${deposit?.virtual_account_id}`);
            virtual_account = virtual_account[0][0];
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
    checkDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params
            let { value } = req.body;

            let obj = {
                is_check_user: value,
            }

            let result = await updateQuery(`${table_name}`, obj, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

const moveUser = async () => {
    const BEFORE_BRAND_ID = 98;
    const BRAND_ID = 120;
    const conn = await writePool.getConnection();
    try {

        let last_mchts = await readPool.query(`SELECT * FROM users WHERE brand_id=${BEFORE_BRAND_ID} AND level=10 AND is_delete=0`);
        last_mchts = last_mchts[0];
        let last_opers = await readPool.query(`SELECT * FROM users WHERE brand_id=${BEFORE_BRAND_ID} AND level > 10 AND level < 40 AND is_delete=0`);
        last_opers = last_opers[0];
        let mchts = await readPool.query(`SELECT * FROM users WHERE brand_id=${BRAND_ID} AND level=10 AND is_delete=0`);
        mchts = mchts[0];
        let opers = await readPool.query(`SELECT * FROM users WHERE brand_id=${BRAND_ID} AND level > 10 AND level < 40 AND is_delete=0`);
        opers = opers[0];
        let connect_obj = {};

        for (var i = 0; i < last_mchts.length; i++) {
            let mcht = _.find(mchts, { user_name: last_mchts[i]?.user_name });
            connect_obj[last_mchts[i]?.id] = mcht?.id;
        }
        for (var i = 0; i < last_opers.length; i++) {
            let oper = _.find(opers, { user_name: last_opers[i]?.user_name });
            connect_obj[last_opers[i]?.id] = oper?.id;
        }
        let summary_columns = [
            `is_cancel`,
            `pay_type`,
            `mcht_id`,
            `sales5_id`,
            `sales4_id`,
            `sales3_id`,
            `sales2_id`,
            `sales1_id`,
            `sales0_id`,
            `deposit_status`,
            `withdraw_status`,
            `withdraw_fee_type`,
            `user_id`,
            `is_hand`,
            `'2025-04-04 11:00:00' AS created_at`,
            `SUM(amount) AS amount`,
            `SUM(expect_amount) AS expect_amount`,
            `SUM(top_office_amount) AS top_office_amount`,
            `SUM(head_office_amount) AS head_office_amount`,
            `SUM(mcht_amount) AS mcht_amount`,
            `SUM(sales5_amount) AS sales5_amount`,
            `SUM(sales4_amount) AS sales4_amount`,
            `SUM(sales3_amount) AS sales3_amount`,
            `SUM(sales2_amount) AS sales2_amount`,
            `SUM(sales1_amount) AS sales1_amount`,
            `SUM(sales0_amount) AS sales0_amount`,
            `SUM(deposit_fee) AS deposit_fee`,
            `SUM(withdraw_fee) AS withdraw_fee`,
        ]
        let group_columns = [
            `is_cancel`,
            `pay_type`,
            `mcht_id`,
            `sales5_id`,
            `sales4_id`,
            `sales3_id`,
            `sales2_id`,
            `sales1_id`,
            `sales0_id`,
            `deposit_status`,
            `withdraw_status`,
            `withdraw_fee_type`,
            `user_id`,
            `is_hand`,
        ]
        let deposit_summary_sql = ` SELECT ${summary_columns.join()} FROM deposits WHERE brand_id=${BEFORE_BRAND_ID} `;
        deposit_summary_sql += ` GROUP BY ${group_columns.join()} `;
        console.log(returnMoment())
        let deposit_summaries = await writePool.query(deposit_summary_sql);
        deposit_summaries = deposit_summaries[0];
        console.log(returnMoment())
        let insert_list = [];
        let columns = [];
        for (var i = 0; i < deposit_summaries.length; i++) {
            deposit_summaries[i].brand_id = BRAND_ID;
            deposit_summaries[i].mcht_id = connect_obj[deposit_summaries[i].mcht_id] ?? null;
            deposit_summaries[i].sales5_id = connect_obj[deposit_summaries[i].sales5_id] ?? null;
            deposit_summaries[i].sales4_id = connect_obj[deposit_summaries[i].sales4_id] ?? null;
            deposit_summaries[i].sales3_id = connect_obj[deposit_summaries[i].sales3_id] ?? null;
            deposit_summaries[i].sales2_id = connect_obj[deposit_summaries[i].sales2_id] ?? null;
            deposit_summaries[i].sales1_id = connect_obj[deposit_summaries[i].sales1_id] ?? null;
            deposit_summaries[i].sales0_id = connect_obj[deposit_summaries[i].sales0_id] ?? null;
            if (i == 0) {
                columns = Object.keys(deposit_summaries[i]);
            }
            insert_list.push(columns.map(el => { return deposit_summaries[i][el] }))
        }
        let result = await insertMultyQuery('deposits', columns, insert_list);
        await conn.commit();
        console.log('success');
    } catch (err) {
        console.log(err);
        await conn.rollback();
    } finally {
        await conn.release();
    }
}
export default depositCtrl;
