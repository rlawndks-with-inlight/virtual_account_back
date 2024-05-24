'use strict';
import axios from "axios";
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, createHashedPassword, isItemBrandIdSameDnsId, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import fs from 'fs';

const table_name = 'logs'


const logCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res)
            }
            const { type, dt } = req.query;
            let data = {};
            if (dt && type) {
                data = await getLogList[type](req.query, decode_user, decode_dns);
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
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res)
            }
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
    remove: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

const getLogList = {
    back: async (query = {}, decode_user, decode_dns) => {
        let data = await getFileLogs('back', query, decode_user, decode_dns);
        return data;
    },
    api: async (query = {}, decode_user, decode_dns) => {
        const { response_result_type, search, dt } = query;
        let columns = [
            `${table_name}.*`,
            'users.user_name',
        ]
        let search_columns = [
            `${table_name}.request`,
            `${table_name}.response_data`,
            `${table_name}.request_ip`,
        ]
        let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
        sql += ` LEFT JOIN users ON users.id=${table_name}.user_id `
        sql += ` WHERE 1=1 `
        if (decode_dns?.is_main_dns != 1) {
            sql += ` AND ${table_name}.brand_id=${decode_dns?.id}`
        }
        let sql_list = [
            { table: 'success', sql: (sql + ` ${sql.includes('WHERE') ? 'AND' : 'WHERE'} response_result > 0 `).replaceAll(process.env.SELECT_COLUMN_SECRET, 'COUNT(*) AS success') },
            { table: 'fail', sql: (sql + ` ${sql.includes('WHERE') ? 'AND' : 'WHERE'} response_result < 0 `).replaceAll(process.env.SELECT_COLUMN_SECRET, 'COUNT(*) AS fail') },
        ];
        if (response_result_type) {
            sql += ` AND ${table_name}.response_result ${response_result_type == 1 ? '>=' : '<'} 0 `
        }
        if (search) {
            sql += makeSearchQuery(search_columns, search);
        }
        let data = await getSelectQuery(sql, columns, { ...query, s_dt: dt, e_dt: dt }, sql_list, decode_user);
        return data;
    },
    noti: async (query = {}, decode_user, decode_dns) => {
        let data = await getFileLogs('noti', query, decode_user, decode_dns);
        return data;
    },
}
const getFileLogs = async (type, query = {}, decode_user, decode_dns) => {
    try {
        const { response_result_type, search = "", dt, page_size = 20, page = 1, } = query;
        let filePath = `${type == 'back' ? './' : '../api/'}logs/${dt}.log`;
        let file = fs.readFileSync(filePath, 'utf-8');
        let lines = file.split('\n');
        lines = lines.splice(0, lines.length - 1);
        if (decode_dns?.is_main_dns != 1 && type == 'back') {
            lines = lines.filter(line => line.includes(`"brand_id":${decode_dns?.id}`));
        }
        lines = lines.filter(line => line.includes(search));
        let success_list = [];
        let fail_list = [];
        if (type == 'back') {
            success_list = lines.filter(line => line.includes(`info:`));
            fail_list = lines.filter(line => line.includes(`error:`));
        } else {
            success_list = lines.filter(line => line.includes(`"res":"0000"`));
            fail_list = lines.filter(line => !line.includes(`"res":"0000"`));
        }

        if (response_result_type == 1) {
            lines = success_list;
        } else if (response_result_type == 2) {
            lines = fail_list;
        }

        let content = [];
        for (var i = lines.length - (page - 1) * page_size; i > lines.length - (page) * page_size; i--) {
            let text = lines[i - 1];
            if (!text) {
                break;
            }
            text = text.split(' ');
            let text_str = '';
            for (var j = 4; j < text.length; j++) {
                text_str += text[j];
            }
            let json = JSON.parse(text_str)
            let obj = {};
            if (type == 'back') {
                obj = {
                    user_id: json?.user_id,
                    request: json?.request,
                    response_result: json?.res?.result,
                    response_message: json?.res?.message,
                    response_data: JSON.stringify(json?.res?.data),
                    request_ip: json?.ip,
                    created_at: `${text[0]} ${text[1]}`,
                }
            } else {
                obj = {
                    user_id: 0,
                    request: JSON.stringify({
                        ...json,
                        url: json?.uri,
                    }),
                    response_result: json?.res,
                    response_message: json?.res,
                    response_data: JSON.stringify({}),
                    request_ip: '',
                    created_at: `${text[0]} ${text[1]}`,
                }
            }
            content.push(obj)
        }
        let data = {
            page,
            page_size,
            total: lines.length,
            content: content,
            success: [
                { success: success_list.length }
            ],
            fail: [
                { fail: fail_list.length }
            ],
        }
        return data;
    } catch (err) {
        console.log(err)
        return {
            page: 1,
            page_size: 20,
            total: 0,
            content: [],
            success: [
                { success: 0 }
            ],
            fail: [
                { fail: 0 }
            ],
        };
    }
}
export default logCtrl;
