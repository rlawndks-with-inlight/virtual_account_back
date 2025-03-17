'use strict';
import _ from "lodash";
import { checkIsManagerUrl, getUserDepositFee, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, createHashedPassword, getOperatorList, isItemBrandIdSameDnsId, lowLevelException, makeObjByList, makeUserChildrenList, makeUserTree, operatorLevelList, response, settingFiles, settingMchtFee } from "../utils.js/util.js";
import 'dotenv/config';
import { emitSocket } from "../utils.js/socket/index.js";
import redisCtrl from "../redis/index.js";
import { readPool, writePool } from "../config/db-pool.js";

const table_name = 'users';

const userCtrl = {
    list: async (req, res, next) => {
        try {
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const {
                level, level_list = [],
                s_dt, e_dt,
                search,
                is_asc,
                page,
                page_size,
            } = req.query;
            if ([10, 20, 30, 50, 100].includes(page_size)) {
                return response(req, res, -100, "페이지 크기가 잘못되었습니다.", false)
            }
            let table = decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account' : 'member'

            let columns = [
                `${table_name}.profile_img`,
                `${table_name}.user_name`,
                `${table_name}.nickname`,
                `${table_name}.name`,
                `${table_name}.deposit_fee`,
                `${table_name}.withdraw_fee`,
                `${table_name}.level`,
                `${table_name}.id`,
                `${table_name}.mid`,
                `${table_name}.virtual_acct_link_status`,
                `${table_name}.withdraw_bank_code`,
                `${table_name}.withdraw_acct_num`,
                `${table_name}.withdraw_acct_name`,
                `${table_name}.phone_num`,
                `${table_name}.created_at`,
                `${table_name}.last_login_time`,
                `${table_name}.connected_ip`,
                `${table_name}.status`,
                `merchandise_columns.mcht_fee`,
                `brands.name AS brand_name`,
                `brands.dns`,
            ]
            if (decode_dns?.withdraw_type == 0) {
                columns = [...columns, ...[
                    `${table}s.guid`,
                    `virtual_accounts.virtual_bank_code`,
                    `virtual_accounts.virtual_acct_num`,
                    `virtual_accounts.virtual_acct_name`,
                    `${table}s.deposit_bank_code AS settle_bank_code`,
                    `${table}s.deposit_acct_num AS settle_acct_num`,
                    `${table}s.deposit_acct_name AS settle_acct_name`,
                ]]
            }
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            let join_sql = ``;
            join_sql += ` LEFT JOIN merchandise_columns ON merchandise_columns.mcht_id=${table_name}.id `;
            join_sql += ` LEFT JOIN brands ON brands.id=${table_name}.brand_id `;
            join_sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
            join_sql += ` LEFT JOIN members ON ${table_name}.member_id=members.id `;
            let operator_list = decode_dns?.operator_list;
            for (var i = 0; i < operator_list.length; i++) {
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_id`);
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_fee`);
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_withdraw_fee`);
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_deposit_fee`);
                columns.push(`sales${operator_list[i]?.num}.user_name AS sales${operator_list[i]?.num}_user_name`);
                columns.push(`sales${operator_list[i]?.num}.nickname AS sales${operator_list[i]?.num}_nickname`);
                join_sql += ` LEFT JOIN users AS sales${operator_list[i]?.num} ON sales${operator_list[i]?.num}.id=merchandise_columns.sales${operator_list[i]?.num}_id `;
            }
            let where_sql = ` WHERE ${(decode_dns?.is_main_dns == 1 && level == 40) ? '1=1' : `${table_name}.brand_id=${decode_dns?.id}`}  `;
            where_sql += ` AND ${table_name}.level <= ${decode_user?.level} `;

            if (decode_user?.level < 40) {
                if (decode_user?.level == 10) {
                    where_sql += ` AND ${table_name}.id=${decode_user?.id} `;
                } else {
                    let merchandise_columns = [];
                    for (var i = 0; i < operator_list.length; i++) {
                        if (operator_list[i]?.value == decode_user?.level) {
                            merchandise_columns = await readPool.query(`SELECT * FROM merchandise_columns WHERE sales${operator_list[i]?.num}_id=${decode_user?.id}`);
                            merchandise_columns = merchandise_columns[0];
                            break;
                        }
                    }
                    let children_ids = [];
                    for (var i = 0; i < merchandise_columns.length; i++) {
                        for (var j = 0; j < operator_list.length; j++) {
                            if (operator_list[i]?.value < decode_user?.level && merchandise_columns[i][`sales${operator_list[i]?.num}_id`] > 0) {
                                children_ids.push(merchandise_columns[i][`sales${operator_list[i]?.num}_id`]);
                            }
                        }
                        children_ids.push(merchandise_columns[i]?.mcht_id ?? 0);
                    }
                    children_ids = new Set(children_ids);
                    children_ids = [...children_ids];
                    children_ids.push(0);
                    where_sql += ` AND ${table_name}.id IN (${children_ids.join()}) `;
                }

            }
            /*
            if (level && level < 40) {
                let level_column = level == 10 ? 'mcht' : `sales${_.find(operatorLevelList, { level: parseInt(level) }).num}`;
                columns.push(`(SELECT SUM(${level_column}_amount) FROM deposits WHERE ${level_column}_id=${table_name}.id) AS settle_amount`);
                columns.push(`(SELECT SUM(${level_column}_amount) FROM deposits WHERE ${level_column}_id=${table_name}.id AND pay_type IN (0)) AS deposit_amount`);
                columns.push(`(SELECT SUM(${level_column}_amount) FROM deposits WHERE ${level_column}_id=${table_name}.id AND pay_type IN (5, 20)) AS withdraw_amount`);
                columns.push(`(SELECT SUM(${level_column}_amount) FROM deposits WHERE ${level_column}_id=${table_name}.id AND pay_type IN (5, 20) AND withdraw_status IN (10, 15)) AS withdraw_fail_amount`);
                columns.push(`(SELECT SUM(${level_column}_amount) FROM deposits WHERE ${level_column}_id=${table_name}.id AND pay_type IN (25)) AS manager_plus_amount`);
                columns.push(`(SELECT SUM(${level_column}_amount) FROM deposits WHERE ${level_column}_id=${table_name}.id AND pay_type IN (30)) AS manager_minus_amount`);
                columns.push(`(SELECT SUM(withdraw_fee) FROM deposits WHERE ${level_column}_id=${table_name}.id AND pay_type IN (5, 20)) AS withdraw_fee_amount`);
            }  
            */

            if (level) {
                where_sql += ` AND ${table_name}.level = ${level} `;
            }
            if (level_list.length > 0) {
                where_sql += ` AND ${table_name}.level IN (${level_list}) `;
            }
            where_sql += ` AND ${table_name}.is_delete=0 `
            if (search) {
                let search_columns = [
                    `${table_name}.user_name`,
                    `${table_name}.nickname`,
                    `${table_name}.name`,
                ]
                if (level == 10) {
                    for (var i = 0; i < operator_list.length; i++) {
                        search_columns.push(`sales${operator_list[i]?.num}.user_name`);
                        search_columns.push(`sales${operator_list[i]?.num}.nickname`);
                    }
                }
                where_sql += makeSearchQuery(search_columns, search);
            }
            let chart_columns = [
                `COUNT(*) AS total`,
            ]
            let chart_sql = sql + (level == 10 ? join_sql : '') + where_sql;
            chart_sql = chart_sql.replaceAll(process.env.SELECT_COLUMN_SECRET, chart_columns.join());

            sql = sql + join_sql + where_sql;
            sql += ` ORDER BY ${table_name}.id ${is_asc ? 'ASC' : 'DESC'} `;
            sql = sql.replaceAll(process.env.SELECT_COLUMN_SECRET, columns.join());
            let data = {};
            let chart = await readPool.query(chart_sql);
            chart = chart[0][0];
            if (chart?.total >= 1 * page_size) {
                sql += ` LIMIT ${(page - 1) * page_size}, ${page_size} `;
            }
            if (chart?.total < (page - 1) * page_size) {
                data = {
                    content: [],
                    total: chart?.total,
                    page,
                    page_size,
                }
                return response(req, res, 100, "success", data);
            }
            let content = await readPool.query(sql);
            content = content[0];
            data = {
                content,
                chart,
            }

            if (level && level < 40 && data.content.length > 0) {
                let level_column = ``;
                if (level == 10) {
                    level_column = 'mcht';
                } else {
                    if (decode_dns?.is_oper_dns == 1) {
                        level_column = `top_offer${_.find(operatorLevelList, { level: parseInt(level) }).num}`;
                    } else {
                        level_column = `sales${_.find(operatorLevelList, { level: parseInt(level) }).num}`;
                    }
                }
                let columns = [];
                if (decode_dns?.is_oper_dns == 1) {
                    columns = [
                        `SUM(${level_column}_amount) AS settle_amount`,
                        `${level_column}_id`,
                        `pay_type`,
                    ];
                } else {
                    columns = [
                        `${level_column}_id`,
                        `SUM(${level_column}_amount) AS ${level_column}_amount`,
                        `SUM(withdraw_fee) AS withdraw_fee`,
                        `pay_type`,
                        `withdraw_status`,
                        /*
                        `SUM(CASE WHEN pay_type IN (0) THEN ${level_column}_amount ELSE 0 END) AS deposit_amount`,
                        `SUM(CASE WHEN pay_type IN (5, 20) THEN ${level_column}_amount ELSE 0 END) AS withdraw_amount`,
                        `SUM(CASE WHEN pay_type IN (5, 20) AND withdraw_status IN (10, 15) THEN ${level_column}_amount ELSE 0 END) AS withdraw_fail_amount`,
                        `SUM(CASE WHEN pay_type IN (25) THEN ${level_column}_amount ELSE 0 END) AS manager_plus_amount`,
                        `SUM(CASE WHEN pay_type IN (30) THEN ${level_column}_amount ELSE 0 END) AS manager_minus_amount`,
                        `SUM(CASE WHEN pay_type IN (5, 20) THEN withdraw_fee ELSE 0 END) AS withdraw_fee_amount`,
                        */
                    ];
                }

                let amount_data = [];
                let slice_num = level == 30 ? 1 : 3;
                for (var i = 0; i < data.content.length / slice_num; i++) {
                    let user_ids = data.content.map(el => { return el?.id }).slice(i * slice_num, (i + 1) * slice_num);
                    if (user_ids.length > 0) {
                        let sql = `SELECT ${columns.join()} FROM deposits `;
                        sql += ` WHERE ${level_column}_id IN (${user_ids.join()})`;
                        sql += ` GROUP BY ${level_column}_id, pay_type, withdraw_status `;
                        let process_amount_data = await readPool.query(sql);
                        process_amount_data = process_amount_data[0];
                        amount_data = [
                            ...amount_data,
                            ...process_amount_data,
                        ]

                    }
                }
                if (decode_dns?.is_oper_dns == 1) {
                    let temporary_level_column = `sales${_.find(operatorLevelList, { level: parseInt(level) }).num}`;
                    let temporary_columns = [
                        `${temporary_level_column}_id`,
                        `SUM(${temporary_level_column}_amount) AS ${temporary_level_column}_amount`,
                        `pay_type`,
                    ];
                    for (var i = 0; i < data.content.length / slice_num; i++) {
                        let user_ids = data.content.map(el => { return el?.id }).slice(i * slice_num, (i + 1) * slice_num);
                        if (user_ids.length > 0) {
                            let sql = `SELECT ${temporary_columns.join()} FROM deposits `;
                            sql += ` WHERE ${temporary_level_column}_id IN (${user_ids.join()})`;
                            sql += ` AND brand_id=${decode_dns?.id} `;
                            sql += ` GROUP BY ${temporary_level_column}_id, pay_type `;
                            let process_amount_data = await readPool.query(sql);
                            process_amount_data = process_amount_data[0];
                            amount_data = [
                                ...amount_data,
                                ...process_amount_data,
                            ]
                        }
                    }
                    for (var i = 0; i < amount_data.length; i++) {
                        if (amount_data[i][`${temporary_level_column}_id`]) {
                            amount_data[i][`${level_column}_id`] = amount_data[i][`${temporary_level_column}_id`];
                            amount_data[i][`${level_column}_amount`] = amount_data[i][`${temporary_level_column}_amount`];
                        }
                    }
                }
                console.log(amount_data)
                /*
                console.log(returnMoment());
                amount_data = await Promise.all(amount_queries);
                console.log(returnMoment());
                amount_data = amount_data.flatMap(res => res[0]);   
                */

                for (var i = 0; i < data.content.length; i++) {
                    let user = data.content[i];
                    let user_data = amount_data.filter(el => el[`${level_column}_id`] == user?.id);
                    data.content[i] = {
                        ...data.content[i],
                        settle_amount: _.sum(user_data.map(el => { return el[`${level_column}_amount`] })),
                        deposit_amount: _.sum(user_data.filter(el => [0].includes(el?.pay_type)).map(el => { return el[`${level_column}_amount`] })),
                        withdraw_amount: _.sum(user_data.filter(el => [5, 20].includes(el?.pay_type)).map(el => { return el[`${level_column}_amount`] })),
                        withdraw_fail_amount: _.sum(user_data.filter(el => [5, 20].includes(el?.pay_type) && [10, 15].includes(el?.withdraw_status)).map(el => { return el[`${level_column}_amount`] })),
                        manager_plus_amount: _.sum(user_data.filter(el => [25].includes(el?.pay_type)).map(el => { return el[`${level_column}_amount`] })),
                        manager_minus_amount: _.sum(user_data.filter(el => [30].includes(el?.pay_type)).map(el => { return el[`${level_column}_amount`] })),
                        withdraw_fee_amount: _.sum(user_data.filter(el => [5, 20].includes(el?.pay_type)).map(el => { return el[`withdraw_fee`] })),
                    }
                }

                data.content = data.content.map(el => {
                    return {
                        ...el,
                        ..._.find(amount_data, { [`${level_column}_id`]: el?.id })
                    }
                })
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
    organizationalChart: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);

            return response(req, res, 100, "success", {});
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    get: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 11, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params;
            let table = decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account' : 'member'
            let columns = [
                `${table_name}.*`,
                `merchandise_columns.mcht_fee`,
                `${table}s.guid`,
                `virtual_accounts.virtual_bank_code`,
                `virtual_accounts.virtual_acct_num`,
                `virtual_accounts.virtual_acct_name`,
                `${table}s.deposit_bank_code AS settle_bank_code`,
                `${table}s.deposit_acct_num AS settle_acct_num`,
                `${table}s.deposit_acct_name AS settle_acct_name`,
            ]
            let operator_list = decode_dns?.operator_list;
            for (var i = 0; i < operator_list.length; i++) {
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_id`);
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_fee`);
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_withdraw_fee`);
                columns.push(`merchandise_columns.sales${operator_list[i]?.num}_deposit_fee`);
            }
            let sql = `SELECT ${columns.join()} FROM ${table_name} `;
            sql += ` LEFT JOIN merchandise_columns ON merchandise_columns.mcht_id=${table_name}.id `;
            sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
            sql += ` LEFT JOIN members ON ${table_name}.member_id=members.id `;
            sql += ` WHERE ${table_name}.id=${id} AND (level < ${decode_user?.level} OR ${table_name}.id=${decode_user?.id})  `;
            let data = await readPool.query(sql);
            data = data[0][0];
            delete data.user_pw;
            delete data.user_salt;
            let ip_logs = await readPool.query(`SELECT * FROM connected_ips WHERE user_id=${data?.id} ORDER BY id DESC`);
            ip_logs = ip_logs[0];
            data['telegram_chat_ids'] = JSON.parse(data?.telegram_chat_ids ?? '[]').join();

            let ip_list = await readPool.query(`SELECT * FROM permit_ips WHERE user_id=${id} AND is_delete=0`);
            data = {
                ...data,
                ip_list: ip_list[0],
                ip_logs,
            }
            let settle_amount_sql = ``;
            let find_oper_level = _.find(operatorLevelList, { level: parseInt(data?.level) });
            if (data?.level == 10) {
                settle_amount_sql = `SELECT SUM(mcht_amount) AS settle_amount FROM deposits WHERE mcht_id=${id}`;

            } else if (find_oper_level) {
                settle_amount_sql = `SELECT SUM(sales${find_oper_level.num}_amount) AS settle_amount FROM deposits WHERE sales${find_oper_level.num}_id=${id}`;
            }
            if (data?.level == 10 || find_oper_level) {
                let settle_amount = await readPool.query(settle_amount_sql);
                settle_amount = settle_amount[0][0]?.settle_amount ?? 0;
                data = {
                    ...data,
                    settle_amount,
                }
            }
            return response(req, res, 100, "success", data)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    getByMID: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { mid } = req.params;

            let columns = [
                `${table_name}.id`,
                `${table_name}.virtual_acct_link_status`,
            ]

            let sql = `SELECT ${columns.join()} FROM ${table_name} `;
            sql += ` WHERE ${table_name}.mid=${mid} `;
            sql += ` AND ${table_name}.brand_id=${decode_dns?.id} `;

            let data = await readPool.query(sql)
            data = data[0][0];


            return response(req, res, 100, "success", data)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    ipLogs: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 11, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.query;
            let columns = [
                `connected_ips.*`,
            ]
            let user = await readPool.query(`SELECT level FROM users WHERE id=${id}`);
            user = user[0][0];

            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM connected_ips `;
            sql += `  WHERE user_id=${id} AND ${decode_user?.level} > ${user?.level} `;

            let data = await getSelectQuery(sql, columns, req.query, [], decode_user, decode_dns);

            return response(req, res, 100, "success", data);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    remove: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let result = await deleteQuery(`${table_name}`, {
                id,
                brand_id: decode_dns?.id,
            })
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    create: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            if (!decode_user) {
                return lowLevelException(req, res)
            }
            const decode_dns = checkDns(req.cookies.dns);
            let {
                brand_id, user_name, user_pw, name, nickname, level, phone_num, profile_img, note,
                mcht_fee = 0,
                guid,
                deposit_fee = 0, withdraw_fee = 0, min_withdraw_price = 0, max_withdraw_price = 0, min_withdraw_remain_price = 0, min_withdraw_hold_price = 0, is_withdraw_hold = 0, can_return_ago_pay = 1, is_not_same_acct_withdraw_minute = 0, daily_withdraw_amount = 0,
                withdraw_bank_code, withdraw_acct_num, withdraw_acct_name, identity = "", telegram_chat_ids = '[]', otp_token = '', sign_key = '', deposit_noti_url = '', withdraw_noti_url = '',
                children_brand_dns = '',
                can_return = 0,
                ip_list = [],
            } = req.body;
            let is_exist_user = await readPool.query(`SELECT * FROM ${table_name} WHERE user_name=? AND brand_id=${brand_id}`, [user_name]);
            if (is_exist_user[0].length > 0) {
                return response(req, res, -100, "유저아이디가 이미 존재합니다.", false)
            }
            let pw_data = await createHashedPassword(user_pw);
            user_pw = pw_data.hashedPassword;
            let user_salt = pw_data.salt;

            let obj = {
                brand_id, user_name, user_pw, user_salt, name, nickname, level, phone_num, profile_img, note,
                deposit_fee, withdraw_fee, min_withdraw_price, max_withdraw_price, min_withdraw_remain_price, min_withdraw_hold_price, is_withdraw_hold, can_return_ago_pay, is_not_same_acct_withdraw_minute, daily_withdraw_amount,
                withdraw_bank_code, withdraw_acct_num, withdraw_acct_name, identity, telegram_chat_ids, otp_token, sign_key, deposit_noti_url, withdraw_noti_url,
                can_return
            };
            let table = decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account' : 'member'
            if (guid) {
                let virtual_account = await readPool.query(`SELECT * FROM ${table}s WHERE guid=? AND brand_id=${decode_dns?.id}`, [guid]);
                virtual_account = virtual_account[0][0];
                if (!virtual_account) {
                    return response(req, res, -100, "guid가 존재하지 않습니다.", false)
                }
                obj[`${table}_id`] = virtual_account?.id;
            } else {
                obj[`${table}_id`]
            }
            if (children_brand_dns) {
                let children_brand = await readPool.query(`SELECT * FROM brands WHERE dns=?`, [children_brand_dns]);
                children_brand = (children_brand[0][0] ?? {});
                obj['children_brand_id'] = children_brand?.id;
                if (children_brand?.id > 0) {
                    let update_children_brand_fee = await updateQuery(`brands`, {
                        head_office_fee: mcht_fee,
                    }, children_brand?.id)
                }
            }



            let result = await insertQuery(`${table_name}`, obj);
            let user_id = result?.insertId;
            let result2 = await updateQuery(table_name, {
                mid: `${decode_dns?.id}${user_id}${new Date().getTime()}`,
            }, user_id);

            let result_ip_list = [];
            for (var i = 0; i < ip_list.length; i++) {
                if (ip_list[i]?.is_delete != 1) {
                    result_ip_list.push([
                        user_id,
                        ip_list[i]?.ip
                    ])
                }
            }
            if (result_ip_list.length > 0) {
                let result_ip = await writePool.query(`INSERT INTO permit_ips (user_id, ip) VALUES ?`, [result_ip_list]);
            }

            if (level == 10) {//가맹점
                let mcht_obj = await settingMchtFee(decode_dns, result?.insertId, req.body);
                if (mcht_obj?.code > 0) {
                    mcht_obj = mcht_obj.data
                    let mcht_result = await insertQuery(`merchandise_columns`, mcht_obj);
                } else {
                    return response(req, res, -100, mcht_obj.message, false)
                }
            }

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
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const decode_dns = checkDns(req.cookies.dns);
            const {
                name, nickname, level, phone_num, profile_img, note,
                mcht_fee = 0,
                guid = "",
                deposit_fee = 0, withdraw_fee = 0, min_withdraw_price = 0, max_withdraw_price = 0, min_withdraw_remain_price = 0, min_withdraw_hold_price = 0, is_withdraw_hold = 0, can_return_ago_pay = 1, is_not_same_acct_withdraw_minute = 0, daily_withdraw_amount = 0,
                withdraw_bank_code, withdraw_acct_num, withdraw_acct_name, identity = "", telegram_chat_ids = '[]', otp_token = '', sign_key = '', deposit_noti_url = '', withdraw_noti_url = '',
                children_brand_dns = "",
                ip_list = [],
                can_return = 0,
                id
            } = req.body;
            let obj = {
                name, nickname, level, phone_num, profile_img, note,
                deposit_fee, withdraw_fee, min_withdraw_price, max_withdraw_price, min_withdraw_remain_price, min_withdraw_hold_price, is_withdraw_hold, can_return_ago_pay, is_not_same_acct_withdraw_minute, daily_withdraw_amount,
                withdraw_bank_code, withdraw_acct_num, withdraw_acct_name, identity, telegram_chat_ids, otp_token, sign_key, deposit_noti_url, withdraw_noti_url,
                can_return,
            };
            let table = decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account' : 'member'
            if (guid) {
                let virtual_account = await readPool.query(`SELECT * FROM ${table}s WHERE guid=? AND brand_id=${decode_dns?.id}`, [guid]);
                virtual_account = virtual_account[0][0];
                if (!virtual_account) {
                    return response(req, res, -100, "guid가 존재하지 않습니다.", false)
                }
                obj[`${table}_id`] = virtual_account?.id;
            } else {
                obj[`${table}_id`] = null;
            }
            if (children_brand_dns) {
                let children_brand = await readPool.query(`SELECT * FROM brands WHERE dns=?`, [children_brand_dns]);
                children_brand = (children_brand[0][0] ?? {});
                obj['children_brand_id'] = children_brand?.id;
                if (children_brand?.id > 0) {
                    let update_children_brand_fee = await updateQuery(`brands`, {
                        head_office_fee: mcht_fee,
                    }, children_brand?.id)
                }
            }

            let operator_list = decode_dns?.operator_list;
            let result = await updateQuery(`${table_name}`, obj, id);

            let result_insert_ip_list = [];
            let result_update_ip_list = [];
            let result_delete_ip_list = [];
            for (var i = 0; i < ip_list.length; i++) {
                if (!ip_list[i]?.id) {
                    if (ip_list[i]?.is_delete != 1) {
                        result_insert_ip_list.push([
                            id,
                            ip_list[i]?.ip,
                        ])
                    }
                } else {
                    if (ip_list[i]?.is_delete == 1) {
                        result_delete_ip_list.push(ip_list[i]?.id);
                    } else {
                        result_update_ip_list.push(ip_list[i]);
                    }
                }
            }
            if (result_insert_ip_list.length > 0) {//신규
                let insert_ip_result = await writePool.query(`INSERT INTO permit_ips (user_id, ip) VALUES ?`, [result_insert_ip_list])
            }
            if (result_update_ip_list.length > 0) {//기존
                for (var i = 0; i < result_update_ip_list.length; i++) {
                    let update_ip_result = await updateQuery(`permit_ips`, {
                        ip: result_update_ip_list[i]?.ip
                    }, result_update_ip_list[i]?.id);
                }
            }
            if (result_delete_ip_list.length > 0) {//기존거 삭제
                let delete_ip_result = await writePool.query(`UPDATE permit_ips SET is_delete=1 WHERE id IN (${result_delete_ip_list.join()})`)
            }

            if (level == 10) {//가맹점
                let mcht_obj = await settingMchtFee(decode_dns, id, req.body);
                if (mcht_obj?.code > 0) {
                    mcht_obj = mcht_obj.data
                    let mcht_result = await updateQuery(`merchandise_columns`, mcht_obj, id, 'mcht_id');
                } else {
                    return response(req, res, -100, mcht_obj.message, false)
                }
            }

            await redisCtrl.delete(`user_only_connect_ip_${id}`);
            await redisCtrl.delete(`user_ip_list_${id}`);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changePassword: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params
            let { user_pw } = req.body;

            let user = await selectQuerySimple(table_name, id);
            user = user[0];
            if (!user || decode_user?.level < user?.level) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            let pw_data = await createHashedPassword(user_pw);
            user_pw = pw_data.hashedPassword;
            let user_salt = pw_data.salt;
            let obj = {
                user_pw, user_salt
            }
            let result = await updateQuery(`${table_name}`, obj, id);
            await redisCtrl.delete(`sign_in_user_${user?.user_name}`);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeStatus: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params
            let { status } = req.body;
            let user = await selectQuerySimple(table_name, id);
            console.log(user)
            user = user[0];
            if (!user || decode_user?.level < user?.level) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            let obj = {
                status
            }
            if (decode_user?.level >= 40) {
                obj['login_fail_count'] = 0;
            }
            let result = await updateQuery(`${table_name}`, obj, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeUserDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            let { amount, pay_type, user_id, note = "", is_use_deposit_fee = 0, } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let user = await selectQuerySimple(table_name, user_id);
            user = user[0];
            amount = parseFloat(amount);
            if (amount < 0 || isNaN(amount)) {
                return response(req, res, -100, "금액은 0 이상만 가능합니다.", false)
            }
            if (pay_type == 25) {
                amount = amount;
            } else if (pay_type == 30) {
                amount = (-1) * amount;
            }
            if (!user) {
                return response(req, res, -100, "존재하지 않는 회원입니다.", false)
            }
            let obj = {
                brand_id: decode_dns?.id,
                pay_type,
                expect_amount: 0,
                amount: 0,
                user_id: user?.id,
                note: note,
            }
            let operator_list = getOperatorList(decode_dns);
            if (user?.level == 10) {
                obj[`mcht_id`] = user?.id
                obj[`mcht_amount`] = amount;
                if (is_use_deposit_fee == 1 && decode_dns?.is_use_deposit_operator == 1) {
                    obj['deposit_fee'] = user?.deposit_fee;
                    obj['mcht_amount'] = amount - user?.deposit_fee;
                    let mcht_column = await readPool.query(`SELECT * FROM merchandise_columns WHERE mcht_id=${user_id}`);
                    mcht_column = mcht_column[0][0];
                    delete mcht_column['id'];
                    user = {
                        ...user,
                        ...mcht_column,
                    }
                    for (var i = 0; i < operator_list.length; i++) {
                        obj['head_office_amount'] = parseFloat(getUserDepositFee(user, 40, operator_list, decode_dns?.deposit_head_office_fee));
                        if (user[`sales${operator_list[i].num}_id`] > 0) {
                            obj[`sales${operator_list[i].num}_amount`] = parseFloat(getUserDepositFee(user, operator_list[i].value, operator_list, decode_dns?.deposit_head_office_fee));
                            obj[`sales${operator_list[i].num}_id`] = user[`sales${operator_list[i].num}_id`];
                        }
                    }
                }
            }

            for (var i = 0; i < operator_list.length; i++) {
                if (user?.level == operator_list[i].value) {
                    obj[`sales${operator_list[i].num}_id`] = user?.id
                    obj[`sales${operator_list[i].num}_amount`] = amount;
                    break;
                }
            }
            let result = await insertQuery(`deposits`, obj);
            let bell_data = {
                amount,
                nickname: user?.nickname,
            }
            emitSocket({
                method: 'settle_plus',
                brand_id: decode_dns?.id,
                data: bell_data
            })

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
}
export default userCtrl;

const asdsdaasd = async () => {
    try {
        let mchts = await readPool.query(`SELECT * FROM users WHERE level=10 AND brand_id=109 AND is_delete=0`);
        mchts = mchts[0];
        let brand_list = [
            {//엠에스
                id: 114,
                oper_id: 2508,
                mcht_nuser_names: mchts
            },
        ]
        for (var i = 0; i < brand_list.length; i++) {
            for (var j = 0; j < brand_list[i].mcht_nuser_names.length; j++) {
                let mcht = brand_list[i].mcht_nuser_names[j];
                if (mcht) {
                    let mcht_obj = { ...mcht };
                    delete mcht_obj['id'];
                    mcht_obj.brand_id = brand_list[i].id;
                    let result = await insertQuery(`users`, mcht_obj);

                    let mcht_columns = await readPool.query(`SELECT * FROM merchandise_columns WHERE mcht_id=${mcht?.id}`);
                    mcht_columns = mcht_columns[0][0];

                    let mcht_id = result?.insertId;
                    let mid_update = await updateQuery(`users`, {
                        mid: `${brand_list[i].id}${mcht_id}${new Date().getTime()}`,
                    }, mcht_id);
                    delete mcht_columns['id'];
                    mcht_columns.mcht_id = mcht_id;
                    mcht_columns.sales5_id = brand_list[i].oper_id;
                    let insert_mcht_columns = await insertQuery(`merchandise_columns`, mcht_columns);
                    console.log(mcht)
                    await new Promise((r) => setTimeout(r, 100));
                }
            }
        }
        console.log('success')
    } catch (err) {
        console.log(err);
    }
}