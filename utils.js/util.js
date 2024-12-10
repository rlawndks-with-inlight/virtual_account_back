import crypto from 'crypto';
import util from 'util';
import { pool } from "../config/db.js";
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { readSync } from 'fs';
import when from 'when';
import _ from 'lodash';
import { getUserWithDrawFee, returnMoment } from './function.js';
import { getMultipleQueryByWhen, insertQuery, updateQuery } from './query-util.js';
import axios from 'axios';
import corpApi from './corp-util/index.js';
import logger from './winston/index.js';
import xlsx from 'xlsx';
import redisCtrl from '../redis/index.js';

const randomBytesPromise = util.promisify(crypto.randomBytes);
const pbkdf2Promise = util.promisify(crypto.pbkdf2);

const createSalt = async () => {
    const buf = await randomBytesPromise(64);
    return buf.toString("base64");
};
export const createHashedPassword = async (password, salt_) => {
    let salt = salt_;
    if (!salt) {
        salt = await createSalt();
    }
    const key = await pbkdf2Promise(password, salt, 104906, 64, "sha512");
    const hashedPassword = key.toString("base64");
    return { hashedPassword, salt };
};

export const makeUserToken = (obj, type = 'user') => {
    let token = jwt.sign({ ...obj },
        type == 'user' ? process.env.JWT_SECRET : process.env.DNS_JWT_SECRET,
        {
            expiresIn: '180m',
            issuer: 'fori',
        });
    return token
}
export const checkLevel = async (token, level, req, is_log = false) => { //유저 정보 뿌려주기
    try {
        const decode_dns = checkDns(req.cookies.dns);
        if (token == undefined)
            return false
        //const decoded = jwt.decode(token)
        const decoded = jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            //console.log(decoded)
            if (err) {
                //  console.log("token이 변조되었습니다." + err);
                return false
            }
            else return decoded;
        })
        if (level > decoded?.level) {
            return false
        }
        if (is_log) {
            return decoded;
        }
        if (decoded?.level >= 45) {

        } else {
            if (decoded?.brand_id != decode_dns?.id) {
                return false;
            }
        }
        if (req) {
            let requestIp = getReqIp(req);
            let user = await redisCtrl.get(`user_only_connect_ip_${decoded?.id}`);
            if (user) {
                user = JSON.parse(user ?? "{}");
            } else {
                user = await pool.query(`SELECT only_connect_ip FROM users WHERE id=${decoded?.id} `);
                user = user?.result[0];
                await redisCtrl.set(`user_only_connect_ip_${decoded?.id}`, JSON.stringify(user), 60);
            }

            let only_connect_ip = user?.only_connect_ip ?? "";
            if (only_connect_ip) {
                if (requestIp != only_connect_ip) {
                    return false;
                }
            }
            let ip_list = await redisCtrl.get(`user_ip_list_${decoded?.id}`);
            if (ip_list) {
                ip_list = JSON.parse(ip_list ?? "[]")
            } else {
                ip_list = await pool.query(`SELECT * FROM permit_ips WHERE user_id=${decoded?.id} AND is_delete=0`);
                ip_list = ip_list?.result;
                await redisCtrl.set(`user_ip_list_${decoded?.id}`, JSON.stringify(ip_list), 60);
            }
            if (decoded?.level < 45 && (!ip_list.map(itm => { return itm?.ip }).includes(requestIp))) {
                return false;
            }
            return decoded;
        } else {
            return decoded;
        }


    }
    catch (err) {
        console.log(err)
        return false
    }
}
export const checkDns = (token) => { //dns 정보 뿌려주기
    try {
        if (token == undefined)
            return false

        //const decoded = jwt.decode(token)
        const decoded = jwt.verify(token, process.env.DNS_JWT_SECRET, (err, decoded) => {
            //console.log(decoded)
            if (err) {
                // console.log("token이 변조되었습니다." + err);
                return false
            }
            else return decoded;
        })
        if (decoded?.id)
            return decoded
        else
            return false
    }
    catch (err) {
        console.log(err)
        return false
    }
}
const logRequestResponse = async (req, res, decode_user, decode_dns) => {//로그찍기
    try {
        let requestIp = getReqIp(req);
        let body = req.body;
        delete body['user_pw'];
        delete body['password'];
        delete body['new_password'];
        delete body['new_password_check'];
        delete body['otp_token'];
        let request = {
            url: req.originalUrl,
            query: req.query,
            params: req.params,
            body: body,
            method: req.method,
        }
        if (request.url.includes('/logs')) {
            return true;
        }
        request = JSON.stringify(request)
        let user_id = 0;
        if (decode_user && !isNaN(parseInt(decode_user?.id))) {
            user_id = decode_user?.id;
        } else {
            user_id = -1;
        }
        let brand_id = -1;
        if (decode_dns) {
            brand_id = decode_dns?.id;
        } else {
            brand_id = -1;
        }
        let data = res?.data ?? {};
        delete data['otp_token'];

        let result = await pool.query(
            "INSERT INTO logs (request, response_data, response_result, response_message, request_ip, user_id, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                request,
                JSON.stringify(data),
                res?.result,
                res?.message,
                requestIp,
                user_id,
                brand_id,
            ]
        )
    } catch (err) {
        console.log(err);
    }

}

export const response = async (req, res, code, message, data) => { //응답 포맷
    let resDict = {
        'result': code,
        'message': message,
        'data': data,
    }
    const decode_user = await checkLevel(req.cookies.token, 0, req, true)
    const decode_dns = checkDns(req.cookies.dns, 0)
    if (req.originalUrl?.includes('/auth') || req.method == 'DELETE' || req.method == 'POST' || req.method == 'PUT' || req.query?.page_size >= 500) {
        let save_log = await logRequestResponse(req, resDict, decode_user, decode_dns);
    }
    if (req?.IS_RETURN) {
        return resDict;
    } else {
        if (code < 0) {
            res.status(500).send(resDict)
        } else {
            res.status(200).send(resDict)
        }
    }
}
export const lowLevelException = (req, res) => {
    return response(req, res, -150, "권한이 없습니다.", false);
}
export const isItemBrandIdSameDnsId = (decode_dns, item) => {
    return decode_dns?.id == item?.brand_id
}
export const settingFiles = (obj) => {
    let keys = Object.keys(obj);
    let result = {};
    for (var i = 0; i < keys.length; i++) {
        let file = obj[keys[i]][0];
        if (!file) {
            continue;
        }
        let is_multiple = false;

        if (obj[keys[i]].length > 1) {
            is_multiple = true;
        }
        if (is_multiple) {
            let files = obj[keys[i]];
            result[`${keys[i].split('_file')[0]}_imgs`] = files.map(item => {
                return (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/' + item.destination + item.filename;
            }).join(',')
            files = `[${files}]`;

        } else {
            file.destination = 'files/' + file.destination.split('files/')[1];
            result[`${keys[i].split('_file')[0]}_img`] = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/' + file.destination + file.filename;
        }
    }
    return result;
}
export const imageFieldList = [
    'logo_file',
    'dark_logo_file',
    'favicon_file',
    'og_file',
    'upload_file',
    'category_file',
    'product_file',
    'profile_file',
    'banner_file',
    'product_banner_file',
    'post_file',

].map(field => {
    return {
        name: field
    }
})
export const makeObjByList = (key, list = []) => {
    let obj = {};
    for (var i = 0; i < list.length; i++) {
        if (!obj[list[i][key]]) {
            obj[list[i][key]] = [];
        }
        obj[list[i][key]].push(list[i]);
    }
    return obj;
}
export const makeChildren = (data_, parent_obj) => {
    let data = data_;
    data.children = parent_obj[data?.id] ?? [];
    if (data.children.length > 0) {
        for (var i = 0; i < data.children.length; i++) {
            data.children[i] = makeChildren(data.children[i], parent_obj);
        }
    } else {
        delete data.children
    }
    return data;
}

export function findChildIds(data, id) {
    const children = data.filter(item => item.parent_id == id).map(item => item.id);
    children.forEach(child => {
        children.push(...findChildIds(data, child));
    });
    return children;
}
export function findParents(data, item) {
    if (!(item?.parent_id > 0)) {
        return [];
    } else {
        const parent = data.filter(itm => itm.id == item.parent_id);
        return [...findParents(data, parent[0]), ...parent]
    }
}
export const makeUserTree = (user_list_ = [], decode_user, decode_dns) => {// 유저트리만들기
    let user_list = user_list_;
    let user_parent_obj = makeObjByList('parent_id', user_list);
    let result = [...user_parent_obj[decode_user?.parent_id ?? '-1'] ?? []];
    console.log(result)
    for (var i = 0; i < result.length; i++) {
        result[i] = makeChildren(result[i], user_parent_obj);
    }
    return result;
}
export const isParentCheckByUsers = (children, parent, user_list, user_obj_) => {//두 유저가 상하위 관계인지
    let user_obj = user_obj_ || makeObjByList('id', user_list);
    let is_parent = false;
    let user = children;
    let parent_id = user?.parent_id;
    while (true) {
        if (parent_id == -1) {
            break;
        }
        if (parent_id == parent?.id) {
            is_parent = true;
            break;
        }
        user = user_obj[parent_id];
        parent_id = user?.parent_id;
    }
    return is_parent;
}

export const makeUserChildrenList = (user_list_ = [], decode_user, decode_dns) => {// 자기 하위 유저들 자기포함 리스트로 불러오기
    let user_list = user_list_;
    let user_parent_obj = makeObjByList('parent_id', user_list);
    let user_obj = makeObjByList('id', user_list);
    let result = [];
    let start_idx = result.length;
    result = [...result, ...user_obj[decode_user?.id]];
    let result_length = result.length;
    while (true) {
        for (var i = start_idx; i < result_length; i++) {
            if (user_parent_obj[result[i]?.id]) {
                result = [...result, ...user_parent_obj[result[i]?.id]];
            }
        }
        start_idx = result_length;
        result_length = result.length;
        if (start_idx == result_length) {
            break;
        }
    }
    return result;
}

export const homeItemsSetting = (column_, products) => {
    let column = column_;

    let item_list = column?.list ?? [];
    item_list = item_list.map(item_id => {
        return { ...item_id, ..._.find(products, { id: parseInt(item_id) }) }
    })
    column.list = item_list;
    return column;
}
export const homeItemsWithCategoriesSetting = (column_, products) => {
    let column = column_;
    for (var i = 0; i < column?.list.length; i++) {
        let item_list = column?.list[i]?.list;
        item_list = item_list.map(item_id => {
            return { ...item_id, ..._.find(products, { id: parseInt(item_id) }) }
        })
        column.list[i].list = item_list;
    }
    return column;
}
export const getReqIp = (req) => {
    let requestIp;
    try {
        requestIp = (req.headers['x-forwarded-for'] ?? "").split(',')[0] || req.connection.remoteAddress || req.ip || '0.0.0.0'
    } catch (err) {
        requestIp = '0.0.0.0'
    }
    requestIp = requestIp.replaceAll('::ffff:', '');
    return requestIp;
}

export const operatorLevelList = [
    { level: 30, num: '5' },
    { level: 25, num: '4' },
    { level: 20, num: '3' },
    { level: 17, num: '2' },
    { level: 15, num: '1' },
    { level: 13, num: '0' },
]
export const getNumberByPercent = (num = 0, percent = 0) => {
    return Math.round(num * (percent).toFixed(2) / 100);
}
export const commarNumber = (num) => {
    if (!num) {
        return 0;
    }
    if (num > 0 && num < 0.000001) {
        return "0.00";
    }
    if (!num && num != 0) {
        return undefined;
    }
    let str = "";
    if (typeof num == "string") {
        str = num;
    } else {
        str = num.toString();
    }

    let decimal = "";
    if (str.includes(".")) {
        decimal = "." + str.split(".")[1].substring(0, 2);
        str = str.split(".")[0];
    } else {
        decimal = "";
    }
    if (str?.length <= 3) {
        return str + decimal;
    }
    let result = "";
    let count = 0;
    for (var i = str?.length - 1; i >= 0; i--) {
        if (count % 3 == 0 && count != 0 && !isNaN(parseInt(str[i]))) result = "," + result;
        result = str[i] + result;
        count++;
    }
    return result + decimal;
}

export const getOperatorList = (brand_) => {
    let operator_list = [];
    let brand = brand_;
    if (typeof brand?.level_obj == 'string') {
        brand['level_obj'] = JSON.parse(brand?.level_obj ?? '{}');
    }
    for (var i = 0; i < operatorLevelList.length; i++) {
        if (brand['level_obj'][`is_use_sales${operatorLevelList[i].num}`] == 1) {
            operator_list.push({
                value: operatorLevelList[i].level,
                label: brand['level_obj'][`sales${operatorLevelList[i].num}_name`],
                num: operatorLevelList[i].num
            })
        }
    }
    return operator_list;
}
export const getChildrenBrands = async (brand = {}) => {
    let brands = await pool.query(`SELECT id, parent_id, name, dns FROM brands`);
    brands = brands?.result;

    let childrens = findChildIds(brands, brand?.id);
    console.log(childrens)
    return childrens;
}
export const getUserDepositFee = (item, user_level, operator_list = [], deposit_head_office_fee) => {
    let top_fee = deposit_head_office_fee;

    let level = 40;
    let result = 0;

    for (var i = 0; i < operator_list.length; i++) {
        if (item[`sales${operator_list[i].num}_id`] > 0) {
            if (user_level == level) {
                return (parseFloat(item[`sales${operator_list[i].num}_deposit_fee`] ?? 0) - parseFloat(top_fee)).toFixed(3);
            }
            top_fee = item[`sales${operator_list[i].num}_deposit_fee`];
            level = operator_list[i].value;
        }
    }
    if (user_level == level) {
        return (parseFloat(item[`deposit_fee`] ?? 0) - parseFloat(top_fee)).toFixed(3);
    }
    // if (user_level == 10) {
    //   return (100 - parseFloat(item[`withdraw_fee`] ?? 0)).toFixed(3);
    // }
    return result;
}
export const getDailyWithdrawAmount = async (user) => {
    let return_moment = returnMoment().substring(0, 10);
    let s_dt = return_moment + ` 00:00:00`;
    let e_dt = return_moment + ` 23:59:59`;
    let sql = `SELECT SUM(mcht_amount) AS withdraw_amount FROM deposits `;
    sql += ` WHERE mcht_id=${user?.id} `;
    sql += ` AND pay_type IN (5, 20) `;
    sql += ` AND withdraw_status IN (0, 5, 20) `;
    sql += ` AND created_at >='${s_dt}' AND created_at <='${e_dt}' `;
    let result = await pool.query(sql);
    result = result?.result[0];
    return result;
}
export const sendNotiPush = async (user = {}, pay_type, data = {}, id) => {
    try {
        if (user[`${pay_type}_noti_url`]) {
            for (var i = 0; i < 5; i++) {
                let { data: result } = await axios.post(user[`${pay_type}_noti_url`], data, {
                    timeout: 5000,
                });
                if (result == '0000') {
                    await updateQuery(`deposits`, {
                        [`${pay_type}_noti_status`]: 0,
                    }, id)
                    break;
                }
                await new Promise((r) => setTimeout(r, 10000));
            }
            if (i == 5) {
                await updateQuery(`deposits`, {
                    [`${pay_type}_noti_status`]: 10,
                }, id)
            }
        }
    } catch (err) {
        console.log(err);
    }
}
export const getMotherDeposit = async (decode_dns, is_detail) => {

    let brand_columns = [
        `brands.id`,
        `virtual_accounts.guid`,
        `virtual_accounts.virtual_bank_code`,
        `virtual_accounts.virtual_acct_num`,
        `virtual_accounts.virtual_acct_name`,
        `virtual_accounts.deposit_bank_code AS settle_bank_code`,
        `virtual_accounts.deposit_acct_num AS settle_acct_num`,
        `virtual_accounts.deposit_acct_name AS settle_acct_name`,
    ]
    let brand_sql = `SELECT ${brand_columns.join()} FROM brands `;
    brand_sql += ` LEFT JOIN virtual_accounts ON brands.virtual_account_id=virtual_accounts.id `;
    brand_sql += ` WHERE brands.id=${decode_dns?.id} `;

    let operator_list = getOperatorList(decode_dns);

    let sum_columns = [
        `SUM(CASE WHEN (pay_type=15 OR is_hand=1) THEN 0 ELSE amount END) AS total_amount`,
        `SUM(CASE WHEN withdraw_status=0 THEN withdraw_fee ELSE 0 END) AS total_withdraw_fee`,
        `SUM(deposit_fee) AS total_deposit_fee`,
        `SUM(mcht_amount) AS total_mcht_amount`,
        `SUM(CASE WHEN withdraw_status=0 THEN 0 ELSE mcht_amount END) AS total_attempt_mcht_withdraw_amount`,
        `SUM(CASE WHEN pay_type=25 THEN mcht_amount ELSE 0 END) AS total_manager_mcht_give_amount`,
        `(SELECT SUM(amount) FROM deposits WHERE pay_type=0 AND deposit_status=0 AND brand_id=${decode_dns?.id}) AS total_deposit_amount`,
        `(SELECT COUNT(*) FROM deposits WHERE pay_type=0 AND deposit_status=0 AND brand_id=${decode_dns?.id}) AS total_deposit_count`,
        `(SELECT COUNT(*) FROM deposits WHERE pay_type IN (5, 20) AND withdraw_status=0 AND brand_id=${decode_dns?.id}) AS total_withdraw_count`,
    ]
    for (var i = 0; i < operator_list.length; i++) {
        sum_columns.push(`SUM(sales${operator_list[i].num}_amount) AS total_sales${operator_list[i].num}_amount`);
        sum_columns.push(`SUM(CASE WHEN withdraw_status=0 THEN 0 ELSE sales${operator_list[i].num}_amount END) AS total_attempt_sales${operator_list[i].num}_withdraw_amount`);
        sum_columns.push(`SUM(CASE WHEN pay_type=25 THEN sales${operator_list[i].num}_amount ELSE 0 END) AS total_manager_sales${operator_list[i].num}_give_amount`);
    }
    let sum_sql = `SELECT ${sum_columns.join()} FROM deposits WHERE brand_id=${decode_dns?.id} `;
    let sql_list = [
        { table: 'brand', sql: brand_sql },
        ...((is_detail || decode_dns?.parent_id > 0) ? [
            { table: 'sum', sql: sum_sql },
        ] : []),
    ]
    let data = await getMultipleQueryByWhen(sql_list);
    data['brand'] = data['brand'][0];
    data['sum'] = data['sum'] ? data['sum'][0] : {};
    data['sum'].total_oper_amount = 0;
    data['sum'].total_attempt_oper_withdraw_amount = 0;
    data['sum'].total_manager_oper_give_amount = 0;
    for (var i = 0; i < operator_list.length; i++) {
        data['sum'].total_oper_amount += data['sum'][`total_sales${operator_list[i].num}_amount`];
        data['sum'].total_attempt_oper_withdraw_amount += data['sum'][`total_attempt_sales${operator_list[i].num}_withdraw_amount`];
        data['sum'].total_manager_oper_give_amount += data['sum'][`total_manager_sales${operator_list[i].num}_give_amount`];
    }
    let real_amount = {
        data: {},
    }
    if (decode_dns?.parent_id > 0) {
        real_amount.data.amount = data['sum'].total_amount + data['sum'].total_withdraw_fee;
    } else {
        real_amount = await corpApi.balance.info({
            pay_type: 'withdraw',
            dns_data: data['brand'],
            decode_user: {},
            guid: data['brand']?.deposit_guid,
        })
    }
    data['real_amount'] = real_amount.data?.amount ?? 0;
    data['hold_deposit_amount'] = real_amount.data?.hold_deposit_amount ?? 0;
    data['childrens'] = [];
    let children_brands = await pool.query(`SELECT * FROM brands WHERE parent_id=${decode_dns?.id}`);
    children_brands = children_brands?.result;
    for (var i = 0; i < children_brands.length; i++) {
        let children_mother_deposit = await getMotherDeposit(children_brands[i]);
        data['childrens'].push(children_mother_deposit);
    }
    data['hold_amount'] = data['brand']?.hold_amount;
    return data;
}

export const settingMchtFee = async (decode_dns, user_id, body) => {
    try {
        let {
            mcht_fee,
            withdraw_fee,
            deposit_fee
        } = body;
        let mother_fee = decode_dns?.head_office_fee;
        let mother_withdraw_fee = decode_dns?.withdraw_head_office_fee;
        let mother_deposit_fee = decode_dns?.deposit_head_office_fee;
        let up_user = '본사';
        let down_user = '';
        let mcht_obj = {
            mcht_id: user_id,
            mcht_fee,
        };
        let operator_list = getOperatorList(decode_dns);
        for (var i = 0; i < operator_list.length; i++) {
            if (body[`sales${operator_list[i]?.num}_id`] > 0) {
                down_user = operator_list[i]?.label;
                if (decode_dns?.is_use_deposit_operator == 1 && !body[`sales${operator_list[i]?.num}_deposit_fee`]) {
                    return {
                        data: {},
                        code: -100,
                        message: `${operator_list[i]?.label}입금수수료를 입력해 주세요.`,
                        level: operator_list[i]?.value,
                        type: 'deposit_fee',
                    }
                }
                if (body[`sales${operator_list[i]?.num}_deposit_fee`] < mother_deposit_fee && decode_dns?.is_use_deposit_operator == 1) {
                    return {
                        data: {},
                        code: -100,
                        message: `${up_user} 입금수수료가 ${down_user} 입금수수료보다 높습니다.`,
                        level: operator_list[i]?.value,
                        type: 'deposit_fee',

                    }
                }
                if (decode_dns?.is_use_fee_operator == 1 && !body[`sales${operator_list[i]?.num}_fee`]) {
                    return {
                        data: {},
                        code: -100,
                        message: `${operator_list[i]?.label}요율을 입력해 주세요.`,
                        level: operator_list[i]?.value,
                        type: 'fee',
                    }
                }
                if (body[`sales${operator_list[i]?.num}_fee`] < mother_fee && decode_dns?.is_use_fee_operator == 1) {
                    return {
                        data: {},
                        code: -100,
                        message: `${up_user} 요율이 ${down_user} 요율보다 높습니다.`,
                        level: operator_list[i]?.value,
                        type: 'fee',
                    }
                }
                if (decode_dns?.is_use_withdraw_operator == 1 && !body[`sales${operator_list[i]?.num}_withdraw_fee`]) {
                    return {
                        data: {},
                        code: -100,
                        message: `${operator_list[i]?.label}출금수수료를 입력해 주세요.`,
                        level: operator_list[i]?.value,
                        type: 'withdraw_fee',
                    }
                }
                if (body[`sales${operator_list[i]?.num}_withdraw_fee`] < mother_withdraw_fee && decode_dns?.is_use_withdraw_operator == 1) {
                    return {
                        data: {},
                        code: -100,
                        message: `${up_user} 출금수수료가 ${down_user} 출금수수료보다 높습니다.`,
                        level: operator_list[i]?.value,
                        type: 'withdraw_fee',
                    }
                }

                up_user = operator_list[i]?.label;
                mother_fee = body[`sales${operator_list[i]?.num}_fee`];
                mother_withdraw_fee = body[`sales${operator_list[i]?.num}_withdraw_fee`];
                mother_deposit_fee = body[`sales${operator_list[i]?.num}_deposit_fee`];
            }
            mcht_obj[`sales${operator_list[i]?.num}_id`] = body[`sales${operator_list[i]?.num}_id`] ?? null;
            mcht_obj[`sales${operator_list[i]?.num}_fee`] = body[`sales${operator_list[i]?.num}_fee`] ?? 0;
            mcht_obj[`sales${operator_list[i]?.num}_withdraw_fee`] = body[`sales${operator_list[i]?.num}_withdraw_fee`] ?? 0;
            mcht_obj[`sales${operator_list[i]?.num}_deposit_fee`] = body[`sales${operator_list[i]?.num}_deposit_fee`] ?? 0;
        }
        down_user = '가맹점';
        if (deposit_fee < mother_deposit_fee && decode_dns?.is_use_deposit_operator == 1) {
            return {
                data: {},
                code: -100,
                message: `${up_user} 입금수수료가 ${down_user} 입금수수료보다 높습니다.`,
                level: 10,
                type: 'deposit_fee',
            }
        }
        if (mcht_fee < mother_fee && decode_dns?.is_use_fee_operator == 1) {
            return {
                data: {},
                code: -100,
                message: `${up_user} 요율이 ${down_user} 요율보다 높습니다.`,
                level: 10,
                type: 'fee',
            }
        }
        if (withdraw_fee < mother_withdraw_fee && decode_dns?.is_use_withdraw_operator == 1) {
            return {
                data: {},
                code: -100,
                message: `${up_user} 출금수수료가 ${down_user} 출금수수료보다 높습니다.`,
                level: 10,
                type: 'withdraw_fee',
            }
        }

        return {
            data: mcht_obj,
            code: 100,
            message: `성공`,
        }
    } catch (err) {
        return {
            data: {},
            code: -100,
            message: `서버 에러 발생`,
        }
    }
}
export const setWithdrawAmountSetting = async (amount_ = 0, user_ = {}, dns_data = {}) => {
    let amount = parseInt(amount_);
    let user = user_;
    let result = {};
    let operator_list = getOperatorList(dns_data);
    result['amount'] = (-1) * (parseInt(amount) + parseInt(user?.withdraw_fee));
    result['expect_amount'] = result['amount'];
    result['withdraw_fee'] = user?.withdraw_fee;
    if (user?.level == 10) {
        let mcht_columns = [
            `merchandise_columns.mcht_fee`
        ]
        for (var i = 0; i < operator_list.length; i++) {
            mcht_columns.push(`merchandise_columns.sales${operator_list[i]?.num}_id`);
            mcht_columns.push(`merchandise_columns.sales${operator_list[i]?.num}_fee`);
            mcht_columns.push(`merchandise_columns.sales${operator_list[i]?.num}_withdraw_fee`);
            mcht_columns.push(`merchandise_columns.sales${operator_list[i]?.num}_deposit_fee`);
        }
        let mcht_sql = `SELECT ${mcht_columns.join()} FROM merchandise_columns `
        mcht_sql += ` WHERE mcht_id=${user?.id} `;
        let mcht = await pool.query(mcht_sql);
        mcht = mcht?.result[0];
        user = {
            ...user,
            ...mcht,
        }
        result['mcht_amount'] = (-1) * (amount + user?.withdraw_fee);
        result['mcht_id'] = user?.id;
        if (dns_data?.is_use_withdraw_operator == 1) {
            result['head_office_amount'] = result['head_office_amount'] ?? 0;
            result['head_office_amount'] = parseFloat(getUserWithDrawFee(user, 40, operator_list, dns_data?.withdraw_head_office_fee));
            for (var i = 0; i < operator_list.length; i++) {
                if (user[`sales${operator_list[i].num}_id`] > 0) {
                    result[`sales${operator_list[i].num}_amount`] = result[`sales${operator_list[i].num}_amount`] ?? 0;
                    result[`sales${operator_list[i].num}_amount`] = parseFloat(getUserWithDrawFee(user, operator_list[i].value, operator_list, dns_data?.withdraw_head_office_fee));
                    result[`sales${operator_list[i].num}_id`] = user[`sales${operator_list[i].num}_id`];
                }
            }
        }
        return result;
    } else {
        for (var i = 0; i < operator_list.length; i++) {
            if (operator_list[i]?.value == user?.level) {
                result[`sales${operator_list[i].num}_id`] = user?.id;
                result[`sales${operator_list[i].num}_amount`] = (-1) * (amount + user?.withdraw_fee);
                break;
            }
        }
        return result;
    }
}
export function generateRandomString(length = 1) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters.charAt(randomIndex);
    }

    return randomString;
}
const sadsafsafsa = async () => {//거래내역비교
    try {
        let sql = ` SELECT deposits.id, deposits.brand_id, deposits.trx_id, deposits.amount, deposits.top_office_amount, deposits.created_at, users.nickname FROM deposits `;
        sql += ` LEFT JOIN users ON users.id=deposits.mcht_id `;
        sql += ` WHERE deposits.pay_type IN (5, 10, 20) `;
        sql += ` AND deposits.brand_id IN (71, 72) AND deposits.created_at >= '2024-03-31 00:00:00' AND withdraw_status=0  ORDER BY deposits.id DESC `;
        let deposits = await pool.query(sql);
        deposits = deposits?.result;
        console.log(deposits.length)
        let first_list = getExcel('./asd4.xlsx');
        console.log(first_list.length)
        let second_list = getExcel('./asd5.xlsx');
        console.log(second_list.length)

        let excel_list = [...first_list, ...second_list];
        let deposit_obj = {};
        for (var i = 0; i < deposits.length; i++) {
            if (!deposit_obj[deposits[i]?.trx_id]) {
                deposit_obj[deposits[i]?.trx_id] = [];
            }
            deposit_obj[deposits[i]?.trx_id].push(deposits[i]);
        }
        let excel_obj = {};
        for (var i = 0; i < excel_list.length; i++) {
            excel_obj[`${excel_list[i]['거래ID'].toString()}`] = excel_list[i];
        }
        let over_deposits = [];
        console.log(excel_list.length);
        for (var i = 0; i < excel_list.length; i++) {
            if (i % 1000 == 0) {
                console.log(i);
            }
            if (!deposit_obj[excel_list[i]['거래ID']]) {
                over_deposits.push(excel_list[i]);
            }
        }
        console.log(over_deposits);
        console.log(over_deposits.length);
        //
        /*
        let second_list = getExcel('./충전정산 거래내역_0420부터.xlsx');
        console.log(second_list.length)  
        */
    } catch (err) {
        console.log(err)
    }
}
const getExcel = (name) => {
    const workbook = xlsx.readFile(name); // 액샐 파일 읽어오기
    const firstSheetName = workbook.SheetNames[0]; // 첫 번째 시트 이름 가져오기
    const firstShee = workbook.Sheets[firstSheetName]; // 시트 이름을 이용해 엑셀 파일의 첫 번째 시트 가져오기

    const excel_list = xlsx.utils.sheet_to_json(firstShee);
    return excel_list;
}
export const findBlackList = async (word, type, decode_dns = {}) => {
    try {
        let black_item = await pool.query(`SELECT * FROM black_lists WHERE is_delete=0 AND acct_num=? AND brand_id=${decode_dns?.id}`, [word]);
        return black_item?.result[0];

    } catch (err) {
        console.log(err);
    }
}
export const userAgentMiddleware = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    const isMobile = /mobile|android|iphone|ipad|windows phone/i.test(userAgent);
    const isPC = /windows|macintosh|linux/i.test(userAgent);
    let requestIp = getReqIp(req);

    const language = req.headers['accept-language'];
    if ((!isMobile && !isPC) || language == '*' || !language) {
        let result = insertQuery(`hacks`, {
            ip: requestIp,
            user_agent: userAgent,
            uri: req.originalUrl,
            language,
            req_body: JSON.stringify(req?.body ?? {})
        })
        return response(req, res, -300, "잘못된 접근 입니다. 아이피가 수집 되었으며, 보안팀에서 검토 예정입니다.", false)
    }
    next(); // 다음 미들웨어 또는 라우트 핸들러로 이동
};
/*
const asdasdasd = async () => {
    try {
        let { data: response } = await axios.get(`https://hynet777888.com/api/domain/?dns=hynet777888.com`, {
            'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'windows'
        });
        // console.log(response)
    } catch (err) {
        // console.log(err);
    }
}
asdasdasd();
*/



