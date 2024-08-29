'use strict';
import _ from "lodash";
import { pool } from "../config/db.js";
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { insertQuery, updateQuery } from "../utils.js/query-util.js";
import { createHashedPassword, checkLevel, makeUserToken, response, checkDns, lowLevelException, operatorLevelList, getReqIp, getChildrenBrands, findParents } from "../utils.js/util.js";
import 'dotenv/config';
import speakeasy from 'speakeasy';
import crypto from 'crypto';

const authCtrl = {
    setting: async (req, res, next) => {
        try {
            const secret = speakeasy.generateSecret({
                length: 20, // 비밀키의 길이를 설정 (20자리)
                name: '123', // 사용자 아이디를 비밀키의 이름으로 설정
                algorithm: 'sha512' // 해시 알고리즘 지정 (SHA-512 사용)
            })

            var verified = speakeasy.totp.verify({
                secret: 'KRHU4Y2OMESFII3HIV3EE23ULN4W2YL5',
                encoding: 'base32',
                token: '392861'
            });
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    signIn: async (req_, res, next) => {
        let req = req_;

        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            let { user_name, user_pw, otp_num } = req.body;

            let dns_data = await pool.query(`SELECT brands.* FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let brands = await pool.query(`SELECT id, parent_id FROM brands`);
            brands = brands?.result;

            let parents = await findParents(brands, dns_data);
            let parent_ids = parents.map(itm => {
                return itm?.id
            })
            let parent_where_sql = ``;
            if (parent_ids.length > 0) {
                parent_where_sql = ` OR (users.level>=40 AND brand_id IN (${parent_ids.join()})) `
            }
            let user = await pool.query(`SELECT * FROM users WHERE user_name=? AND ( brand_id=${decode_dns?.id} ${parent_where_sql} OR level >=50 ) AND is_delete=0 LIMIT 1 `, user_name);
            user = user?.result[0];
            if (!user) {
                return response(req, res, -100, "가입되지 않은 회원입니다.", {})
            }
            let requestIp = getReqIp(req);
            if (user?.only_connect_ip) {
                if (requestIp != user?.only_connect_ip) {
                    return response(req, res, -150, "권한이 없습니다.", {})
                }
            }
            let ip_list = await pool.query(`SELECT * FROM permit_ips WHERE user_id=${user?.id} AND is_delete=0`);
            ip_list = ip_list?.result;
            if (user?.level < 45 && (!ip_list.map(itm => { return itm?.ip }).includes(requestIp))) {
                return response(req, res, -150, "권한이 없습니다.", {})
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
            if (dns_data?.is_use_otp == 1 && user?.level < 45) {
                let otp_token = '';
                if (!otp_num) {
                    return response(req, res, -100, "OTP번호를 입력해주세요.", {})
                }

                if (user?.level < 40) {
                    if (!user?.otp_token) {
                        return response(req, res, -100, "OTP키 발급이 필요합니다.", {})
                    }
                    otp_token = user?.otp_token;
                } else {
                    otp_token = dns_data?.otp_token;
                }
                var verified = speakeasy.totp.verify({
                    secret: otp_token,
                    encoding: 'base32',
                    token: otp_num
                });
                if (!verified) {
                    return response(req, res, -100, "OTP번호가 잘못되었습니다.", {})
                }
            }

            let user_obj = {
                id: user.id,
                user_name: user.user_name,
                name: user.name,
                nickname: user.nickname,
                level: user.level,
                phone_num: user.phone_num,
                profile_img: user.profile_img,
                brand_id: user.brand_id,
                mid: user.mid,
                withdraw_bank_code: user.withdraw_bank_code,
                withdraw_acct_num: user.withdraw_acct_num,
                withdraw_acct_name: user.withdraw_acct_name,
                can_return: user.can_return,
                ip: requestIp,
            }
            if (user?.brand_id != decode_dns?.id && user?.level == 40) {
                user_obj['level'] = 45;
            }
            const token = makeUserToken(user_obj);
            res.cookie("token", token, {
                httpOnly: true,
                maxAge: (60 * 60 * 1000) * 12 * 2,
                //sameSite: 'none', 
                //secure: true 
            });
            let insert_ip_log = await insertQuery(`connected_ips`, {
                user_id: user?.id,
                ip: requestIp,
            })
            let check_last_login_time = await updateQuery('users', {
                last_login_time: returnMoment(),
                login_fail_count: 0,
                connected_ip: requestIp,
            }, user.id)
            return response(req, res, 100, "success", user_obj)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    signInAnotherUser: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let { user_id } = req.body;


            let dns_data = await pool.query(`SELECT brands.* FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];


            let user = await pool.query(`SELECT * FROM users WHERE id=${user_id}`);
            user = user?.result[0];

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
                withdraw_bank_code: user.withdraw_bank_code,
                withdraw_acct_num: user.withdraw_acct_num,
                withdraw_acct_name: user.withdraw_acct_name,
                can_return: user.can_return,
            })
            res.cookie("token", token, {
                httpOnly: true,
                maxAge: (60 * 60 * 1000) * 12 * 2,
                //sameSite: 'none', 
                //secure: true 
            });

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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
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
            const decode_user = await checkLevel(req.cookies.token, is_manager ? 1 : 0);
            if (!decode_user) {
                return response(req, res, -150, "권한이 없습니다.", {})
            }
            let requestIp = getReqIp(req);
            let user = await pool.query(`SELECT only_connect_ip FROM users WHERE id=${decode_user?.id} `);
            user = user?.result[0];
            if (user?.only_connect_ip) {
                if (requestIp != user?.only_connect_ip) {
                    return response(req, res, -150, "권한이 없습니다.", {})
                }
            }
            let ip_list = await pool.query(`SELECT * FROM permit_ips WHERE user_id=${decode_user?.id} AND is_delete=0`);
            ip_list = ip_list?.result;
            if (decode_user?.level < 45 && (!ip_list.map(itm => { return itm?.ip }).includes(requestIp))) {
                res.clearCookie('token');
                return response(req, res, -150, "권한이 없습니다.", {})
            }
            return response(req, res, 100, "success", decode_user)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changePassword: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, is_manager ? 1 : 0);
            if (!decode_user) {
                return response(req, res, -150, "권한이 없습니다.", {})
            }
            let requestIp = getReqIp(req);
            let ip_list = await pool.query(`SELECT * FROM permit_ips WHERE user_id=${decode_user?.id} AND is_delete=0`);
            ip_list = ip_list?.result;
            if (decode_user?.level < 50 && (!ip_list.map(itm => { return itm?.ip }).includes(requestIp)) && ip_list.length > 0) {
                return response(req, res, -150, "권한이 없습니다.", {})
            }
            let {
                password,
                new_password,
            } = req.body;
            let user = await pool.query(`SELECT * FROM users WHERE id=${decode_user?.id}`);
            user = user?.result[0];

            password = (await createHashedPassword(password, user.user_salt)).hashedPassword;
            if (password != user.user_pw) {
                return response(req, res, -100, '비밀번호가 일치하지 않습니다.', false);
            }
            let pw_data = await createHashedPassword(new_password);
            let user_pw = pw_data.hashedPassword;
            let user_salt = pw_data.salt;
            let result = await updateQuery(`users`, {
                user_pw,
                user_salt,
            }, decode_user?.id)

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    deposit: async (req, res, next) => {//보유정산금
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, is_manager ? 1 : 0);
            const decode_dns = checkDns(req.cookies.dns);
            let table = decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account' : 'member'
            let deposit_column = [
                `users.id`,
                `users.user_name`,
                `users.name`,
                `users.nickname`,
                `users.level`,
                `users.phone_num`,
                `users.profile_img`,
                `users.brand_id`,
                `users.mid`,
                `users.withdraw_bank_code`,
                `users.withdraw_acct_num`,
                `users.withdraw_acct_name`,
                `users.can_return`,
                `users.withdraw_fee`,
                `users.min_withdraw_hold_price`,
                `${table}s.guid`,
                `virtual_accounts.virtual_bank_code`,
                `virtual_accounts.virtual_acct_num`,
                `virtual_accounts.virtual_acct_name`,
                `${table}s.deposit_bank_code AS settle_bank_code`,
                `${table}s.deposit_acct_num AS settle_acct_num`,
                `${table}s.deposit_acct_name AS settle_acct_name`,
            ];
            if (decode_user?.level >= 40) {
                return response(req, res, 100, "success", {})
            } else {
                if (decode_user?.level >= 0) {
                    if (decode_user?.level == 10) {
                        deposit_column.push(`(SELECT SUM(mcht_amount) FROM deposits WHERE mcht_id=${decode_user?.id}) AS settle_amount`);
                    } else {
                        let find_oper_level = _.find(operatorLevelList, { level: parseInt(decode_user?.level) });
                        deposit_column.push(`(SELECT SUM(sales${find_oper_level.num}_amount) FROM deposits WHERE sales${find_oper_level.num}_id=${decode_user?.id}) AS settle_amount`);
                    }
                    let deposit_sql = ` SELECT ${deposit_column.join()} FROM users `;
                    deposit_sql += ` LEFT JOIN virtual_accounts ON users.virtual_account_id=virtual_accounts.id `;
                    deposit_sql += ` LEFT JOIN members ON users.member_id=members.id `;
                    deposit_sql += ` WHERE users.id=${decode_user?.id} `;
                    let deposit = await pool.query(deposit_sql);
                    deposit = deposit?.result[0];
                    return response(req, res, 100, "success", deposit)
                } else {
                    return response(req, res, 100, "success", {})
                }
            }

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    getMySignKey: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            let { mid = "" } = req.query;
            let user = {};
            if (decode_user) {
                user = await pool.query(`SELECT * FROM users WHERE id=${decode_user?.id ?? 0}`);
                user = user?.result[0];
            } else {
                user = await pool.query(`SELECT * FROM users WHERE mid=?`, [
                    mid,
                ]);
                user = user?.result[0];
            }
            mid = user?.mid ?? "";
            let sign_key = user?.sign_key ?? "";

            let api_sign_val = crypto.createHash('sha256').update(`${decode_dns?.api_key}${mid}${sign_key}`).digest('hex');
            return response(req, res, 100, "success", {
                api_sign_val
            })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default authCtrl;