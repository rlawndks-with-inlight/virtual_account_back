'use strict';
import _ from "lodash";
import { pool } from "../config/db.js";
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { insertQuery, updateQuery } from "../utils.js/query-util.js";
import { createHashedPassword, checkLevel, makeUserToken, response, checkDns, lowLevelException, operatorLevelList } from "../utils.js/util.js";
import 'dotenv/config';

const authCtrl = {
    signIn: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let { user_name, user_pw } = req.body;

            let user = await pool.query(`SELECT * FROM users WHERE user_name=? AND ( brand_id=${decode_dns?.id} OR level >=50 ) LIMIT 1`, user_name);
            user = user?.result[0];
            if (!user) {
                return response(req, res, -100, "가입되지 않은 회원입니다.", {})
            }
            if (is_manager && user.level <= 0) {
                return response(req, res, -100, "가입되지 않은 회원입니다.", {})
            }
            if (user?.status == 1) {
                return response(req, res, -100, "승인 대기중입니다.", {})
            }
            if (user?.status == 2) {
                return response(req, res, -100, "로그인 차단 회원입니다. 관리자에게 문의하세요.", {})
            }
            user_pw = (await createHashedPassword(user_pw, user.user_salt)).hashedPassword;
            if (user_pw != user.user_pw) {
                let login_fail_obj = {
                    login_fail_count: user?.login_fail_count + 1,
                }
                let err_message = '가입되지 않은 회원입니다.';
                if (login_fail_obj.login_fail_count == 5) {
                    login_fail_obj.status = 2;
                    err_message = `로그인 5회실패, 관리자에게 문의해주세요.`
                }
                let add_login_fail_count = await updateQuery(`users`, login_fail_obj, user?.id);
                return response(req, res, -100, err_message, {});

            }
            const token = makeUserToken({
                id: user.id,
                user_name: user.user_name,
                name: user.name,
                nickname: user.nickname,
                level: user.level,
                phone_num: user.phone_num,
                profile_img: user.profile_img,
                brand_id: user.brand_id,
                mid: user.mid,
            })
            res.cookie("token", token, {
                httpOnly: true,
                maxAge: (60 * 60 * 1000) * 12 * 2,
                //sameSite: 'none', 
                //secure: true 
            });
            let check_last_login_time = await updateQuery('users', {
                last_login_time: returnMoment(),
                login_fail_count: 0,
            }, user.id)

            return response(req, res, 100, "success", user)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    signUp: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                user_name,
                user_pw,
                name,
                nickname,
                level = 0,
                phone_num,
                profile_img,
                brand_id
            } = req.body;
            if (!user_pw) {
                return response(req, res, -100, "비밀번호를 입력해 주세요.", {});
            }
            let pw_data = await createHashedPassword(user_pw);
            if (!is_manager) {
                if (level > 0) {
                    return lowLevelException(req, res);
                }
            }
            user_pw = pw_data.hashedPassword;
            let user_salt = pw_data.salt;
            let obj = {
                user_name,
                user_pw,
                name,
                nickname,
                level,
                phone_num,
                profile_img,
                brand_id,
                user_salt
            }
            let result = await insertQuery('users', obj);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(JSON.stringify(err))
            return response(req, res, -200, err?.message || "서버 에러 발생", false)
        } finally {

        }
    },
    signOut: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            res.clearCookie('token');
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    checkSign: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, is_manager ? 1 : 0);
            const decode_dns = checkDns(req.cookies.dns);

            return response(req, res, 100, "success", decode_user)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    deposit: async (req, res, next) => {//보유정산금
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, is_manager ? 1 : 0);
            const decode_dns = checkDns(req.cookies.dns);
            let deposit_column = [
                `users.*`,
                `virtual_accounts.guid`,
                `virtual_accounts.virtual_bank_code`,
                `virtual_accounts.virtual_acct_num`,
                `virtual_accounts.virtual_acct_name`,
                `virtual_accounts.deposit_bank_code AS settle_bank_code`,
                `virtual_accounts.deposit_acct_num AS settle_acct_num`,
                `virtual_accounts.deposit_acct_name AS settle_acct_name`,
            ];

            if (decode_user?.level >= 40) {
                return response(req, res, 100, "success", {})
            } else {
                if (decode_user?.level == 10) {
                    deposit_column.push(`(SELECT SUM(mcht_amount) FROM deposits WHERE mcht_id=${decode_user?.id}) AS settle_amount`);
                } else {
                    let find_oper_level = _.find(operatorLevelList, { level: parseInt(decode_user?.level) });
                    deposit_column.push(`(SELECT SUM(sales${find_oper_level.num}_amount) FROM deposits WHERE sales${find_oper_level.num}_id=${decode_user?.id}) AS settle_amount`);
                }
                let deposit_sql = ` SELECT ${deposit_column.join()} FROM users `;
                deposit_sql += ` LEFT JOIN virtual_accounts ON users.virtual_account_id=virtual_accounts.id `;
                deposit_sql += ` WHERE users.id=${decode_user?.id} `;
                let deposit = await pool.query(deposit_sql);
                deposit = deposit?.result[0];
                return response(req, res, 100, "success", deposit)
            }

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default authCtrl;