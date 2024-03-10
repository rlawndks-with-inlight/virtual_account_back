'use strict';
import db, { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, createHashedPassword, getOperatorList, isItemBrandIdSameDnsId, response, settingFiles, settingMchtFee } from "../utils.js/util.js";
import 'dotenv/config';

const bulkUploadCtrl = {
    merchandise: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 40);
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
                    })
                    let user_id = result?.result?.insertId;
                    let mcht_obj = await settingMchtFee(decode_dns, user_id, data[i]);
                    if (mcht_obj?.code > 0) {
                        mcht_obj = mcht_obj.data
                        let mcht_result = await insertQuery(`merchandise_columns`, mcht_obj);
                    } else {
                        error_list.push({
                            idx: `${i}-fee`,
                            message: mcht_obj.message,
                        })
                    }
                }
            }

            await db.commit();
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            await db.rollback();
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },

};

export default bulkUploadCtrl;
