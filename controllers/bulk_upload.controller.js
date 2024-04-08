'use strict';
import _ from "lodash";
import db, { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, createHashedPassword, getOperatorList, isItemBrandIdSameDnsId, response, settingFiles, settingMchtFee } from "../utils.js/util.js";
import 'dotenv/config';

const bulkUploadCtrl = {
    merchandise: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                brand_id, data = [],
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let files = settingFiles(req.files);
            let obj = {
                brand_id, data,
            };
            let operator_list = getOperatorList(decode_dns);
            let error_list = [];
            let operators = await pool.query(`SELECT user_name, id, level FROM users WHERE brand_id=${decode_dns?.id} AND level > 10 AND level < 40`);
            operators = operators?.result;

            await db.beginTransaction();
            for (var i = 0; i < data.length; i++) {
                let is_error = false;
                let {
                    user_name,
                    user_pw,
                    nickname,
                    name,
                    phone_num,
                    min_withdraw_price,
                    min_withdraw_remain_price,
                    min_withdraw_hold_price,
                    is_withdraw_hold,
                    deposit_fee,
                    withdraw_fee,
                    mcht_fee,
                } = data[i];
                let data_obj = { ...data[i] };
                let is_exist_user = await pool.query(`SELECT * FROM users WHERE user_name=? AND brand_id=${brand_id}`, [user_name]);
                if (is_exist_user?.result.length > 0) {
                    error_list.push({
                        idx: `${i}-user_name`,
                        message: '유저아이디가 이미 존재합니다.',
                    })
                    is_error = 1;
                }
                let pw_data = await createHashedPassword(user_pw);
                user_pw = pw_data.hashedPassword;
                let user_salt = pw_data.salt;

                if (!is_error) {
                    let result = await insertQuery(`users`, {
                        brand_id,
                        user_name,
                        user_pw,
                        user_salt,
                        nickname,
                        name,
                        phone_num,
                        min_withdraw_price,
                        min_withdraw_remain_price,
                        min_withdraw_hold_price,
                        is_withdraw_hold,
                        deposit_fee,
                        withdraw_fee,
                        level: 10,
                        mid: `${decode_dns?.id}${user_id}${new Date().getTime()}`,
                    })
                    let user_id = result?.result?.insertId;
                    let result2 = await updateQuery(table_name, {
                        mid: `${decode_dns?.id}${user_id}${new Date().getTime()}`,
                    }, user_id);
                    for (var j = 0; j < operator_list.length; j++) {
                        if (data_obj[`sales${operator_list[j]?.num}_user_name`]) {
                            let operator = _.find(operators, { user_name: data_obj[`sales${operator_list[j]?.num}_user_name`] });
                            if (!operator) {
                                error_list.push({
                                    idx: `${i}-sales${operator_list[j]?.num}_user_name`,
                                    message: `존재하지 않는 ${operator_list[j]?.label} 입니다.`,
                                })
                                continue;
                            }
                            if (operator?.level != operator_list[j]?.value) {
                                error_list.push({
                                    idx: `${i}-sales${operator_list[j]?.num}_user_name`,
                                    message: '영업자 레벨이 잘못되었습니다.',
                                })
                                continue;
                            }
                            data_obj[`sales${operator_list[j]?.num}_id`] = _.find(operators, { user_name: data_obj[`sales${operator_list[j]?.num}_user_name`] })?.id;
                        }
                    }
                    let mcht_obj = await settingMchtFee(decode_dns, user_id, data_obj);
                    if (mcht_obj?.code > 0) {
                        mcht_obj = mcht_obj.data
                        let mcht_result = await insertQuery(`merchandise_columns`, mcht_obj);
                    } else {
                        let column = '';
                        if (mcht_obj?.level == 10) {
                            column = `mcht_${mcht_obj.type}`
                        } else {
                            column = `sales${_.find(operator_list, { value: mcht_obj?.level })?.num}_${mcht_obj.type}`
                        }
                        error_list.push({
                            idx: `${i}-${column}`,
                            message: mcht_obj.message,
                        })
                    }
                }
            }
            if (error_list.length > 0) {
                await db.rollback();
            } else {
                await db.commit();
            }
            return response(req, res, 100, "success", {
                error_list
            })
        } catch (err) {
            console.log(err)
            await db.rollback();
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },

};

export default bulkUploadCtrl;
