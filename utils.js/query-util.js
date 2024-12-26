import 'dotenv/config';
import when from 'when';
import { differenceTwoDate, returnMoment } from './function.js';
import { readPool, writePool } from '../config/db-pool.js';

export const insertQuery = async (table, obj) => {
    let keys = Object.keys(obj);
    if (keys.length == 0) {
        return false;
    }
    let question_list = keys.map(key => {
        return '?'
    });
    let values = keys.map(key => {
        return obj[key]
    });
    let result = await writePool.query(`INSERT INTO ${table} (${keys.join()}) VALUES (${question_list.join()})`, values);
    return result[0];
}
export const insertQueryMultiRow = async (table, list) => {// 개발예정
    let keys = Object.keys(obj);
    if (keys.length == 0) {
        return false;
    }
    let question_list = keys.map(item => {
        return '?'
    });
    let values = keys.map(key => {
        return obj[key]
    });
    let result = await writePool.query(`INSERT INTO ${table} (${keys.join()}) VALUES (${question_list.join()})`, values);
    return result[0];
}
export const deleteQuery = async (table, where_obj, delete_true) => {
    let keys = Object.keys(where_obj);
    let where_list = [];
    for (var i = 0; i < keys.length; i++) {
        where_list.push(` ${keys[i]}=${where_obj[keys[i]]} `);
    }
    if (where_list.length == 0) {
        return true;
    }
    let sql = `UPDATE ${table} SET is_delete=1 WHERE ${where_list.join('AND')} `;
    if (delete_true) {
        sql = `DELETE FROM ${table} WHERE ${where_list.join('AND')}`
    }
    let result = await writePool.query(sql);
    return result[0];
}
export const updateQuery = async (table, obj, id, id_column) => {
    let keys = Object.keys(obj);
    if (keys.length == 0) {
        return false;
    }
    let question_list = keys.map(key => {
        return `${key}=?`
    });
    let values = keys.map(key => {
        return obj[key]
    });
    let result = await writePool.query(`UPDATE ${table} SET ${question_list.join()} WHERE ${id_column || 'id'}=${id}`, values);
    return result[0];
}
export const selectQuerySimple = async (table, id) => {
    let result = await readPool.query(`SELECT * FROM ${table} WHERE id=?`, [id]);
    return result[0];
}
export const getTableNameBySelectQuery = (sql) => {// select query 가지고 불러올 메인 table명 불러오기 select * from user as asd
    let sql_split_list = sql.split(' FROM ')[1].split(' ');
    let table = '';
    for (var i = 0; i < sql_split_list.length; i++) {
        if (sql_split_list[i]) {
            table = sql_split_list[i];
            break;
        }
    }
    return table;
}
export const getSelectQuery = async (sql_, columns, query, add_sql_list = [], decode_user, decode_dns, not_use_delete = false) => {

    const { page = 1, page_size = 100000, is_asc = false, order = 'id', s_dt, e_dt, is_excel } = query;


    let sql = sql_;
    let table = getTableNameBySelectQuery(sql);
    let attempt_excel_id = 0;
    if (is_excel) {
        let check_attempt_excel_history_sql = `SELECT * FROM excel_exports`;
        check_attempt_excel_history_sql += ` WHERE user_id=${decode_user?.id} AND table_name=? AND query=? `;
        check_attempt_excel_history_sql += ` AND (created_at BETWEEN '${returnMoment().substring(0, 10)} 00:00:00' AND '${returnMoment().substring(0, 10)} 23:59:59')`;
        let check_attempt_excel_histories = await readPool.query(check_attempt_excel_history_sql, [table, JSON.stringify(query)]);
        check_attempt_excel_histories = check_attempt_excel_histories[0];
        if (check_attempt_excel_histories.length >= 5) {
            return {
                total: 0,
                page,
                page_size,
                content: [],
                chart: []
            }
        }
        let attempt_excel = await insertQuery(`excel_exports`, {
            brand_id: decode_dns?.id,
            user_id: decode_user?.id,
            status: 1,
            table_name: table,
            query: JSON.stringify(query),
        })
        attempt_excel_id = attempt_excel?.insertId;
    }

    sql = settingSelectQueryWhere(sql, query, table, not_use_delete);
    for (var i = 0; i < add_sql_list.length; i++) {
        add_sql_list[i].sql = settingSelectQueryWhere(add_sql_list[i].sql, query, table, not_use_delete);
    }
    let content_sql = sql.replaceAll(process.env.SELECT_COLUMN_SECRET, columns.join());
    content_sql += ` ORDER BY ${table}.${order} ${is_asc ? 'ASC' : 'DESC'} `;
    content_sql += ` LIMIT ${(page - 1) * page_size}, ${page_size} `;
    let total_sql = sql.replaceAll(process.env.SELECT_COLUMN_SECRET, 'COUNT(*) as total');
    let total = await readPool.query(total_sql);
    total = total[0][0]?.total ?? 0;
    if (total > 30000 && page_size > 30000) {
        return {
            total: 0,
            page,
            page_size,
            content: [],
            chart: []
        }
    }
    let result_list = [];
    let sql_list = [
        { table: 'content', sql: content_sql },
        ...add_sql_list
    ]
    for (var i = 0; i < sql_list.length; i++) {
        result_list.push({
            table: sql_list[i].table,
            content: (await readPool.query(sql_list[i].sql))
        });
    }

    for (var i = 0; i < result_list.length; i++) {
        await result_list[i];
    }
    let result = (await when(result_list));
    let obj = {
        page,
        page_size,
    }
    for (var i = 0; i < result.length; i++) {
        obj[result[i].table] = result[i]?.content[0];
    }
    let return_result = settingSelectQueryObj(obj);
    return_result.page = parseInt(return_result.page);
    return_result.page_size = parseInt(return_result.page_size);
    for (var i = 0; i < return_result.content.length; i++) {
        let keys = Object.keys(return_result.content[i]);
        for (var j = 0; j < keys.length; j++) {
            if (keys[j].includes('d_at')) {
                return_result.content[i][keys[j]] = returnMoment(return_result.content[i][keys[j]])
            }
        }
        return_result.content[i]['No_'] = getNumberByTable(return_result.total, return_result.page, return_result.page_size, i);
    }
    if (is_excel) {
        let attempt_excel_update = await updateQuery(`excel_exports`, {
            status: 0,
            total: total,
        }, attempt_excel_id)
    }
    return_result.total = total;
    return return_result;
}
const getNumberByTable = (total = 0, page = 1, page_size = 10, idx = 0) => {
    let result = total;
    result -= (page - 1) * page_size;
    result -= idx;
    return result;
}
const settingSelectQueryWhere = (sql_, query, table, not_use_delete = false) => {
    let sql = sql_;
    const { s_dt, e_dt, search, is_delete } = query;
    if (!not_use_delete) {
        sql += ` ${sql.includes('WHERE') ? 'AND' : 'WHERE'} ${table}.is_delete=${is_delete || '0'} `;
    }
    let add_sql = '';
    if (s_dt) {
        add_sql += ` AND ${table}.created_at >= '${s_dt} 00:00:00' `;
    }
    if (e_dt) {
        add_sql += ` AND ${table}.created_at <= '${e_dt} 23:59:59' `;
    }
    if (s_dt && e_dt) {
        add_sql = ` AND (${table}.created_at BETWEEN '${s_dt} 00:00:00' AND '${e_dt} 23:59:59') `;
    }
    if (search) {

    }
    sql += add_sql;
    return sql;
}

export const makeSearchQuery = (search_columns = [], search = "") => {
    let where_sql = '';
    for (var i = 0; i < search_columns?.length; i++) {
        if (i == 0) {
            where_sql += ` AND ( `
        } else {
            where_sql += ` OR `
        }
        where_sql += ` ${search_columns[i]} LIKE '%${search}%' `;
    }
    where_sql += ` ) `;

    return where_sql;

}
const settingSelectQueryObj = (obj_) => {
    let obj = obj_;
    if (obj?.total) {
        obj['total'] = obj?.total[0]?.total ?? 0
    }
    return obj;
}
export const getMultipleQueryByWhen = async (sql_list) => {
    let result_list = [];
    for (var i = 0; i < sql_list.length; i++) {
        result_list.push({
            table: sql_list[i].table,
            content: (await writePool.query(sql_list[i].sql))
        });
    }
    for (var i = 0; i < result_list.length; i++) {
        await result_list[i];
    }
    let result = (await when(result_list));
    let data = {};
    for (var i = 0; i < result.length; i++) {
        data[result[i].table] = result[i]?.content[0]
    }
    return data;
}