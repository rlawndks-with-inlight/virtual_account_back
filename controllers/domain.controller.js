'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { checkLevel, findChildIds, findParents, getOperatorList, makeUserToken, operatorLevelList, response } from "../utils.js/util.js";
import 'dotenv/config';

const domainCtrl = {
    get: async (req, res, next) => {
        try {
            const { dns } = req.query;
            let columns = [
                'id',
                'name',
                'dns',
                'logo_img',
                'dark_logo_img',
                'favicon_img',
                'og_img',
                'og_description',
                'theme_css',
                'setting_obj',
                'level_obj',
                'bizppurio_obj',
                'is_main_dns',
                'company_name',
                'business_num',
                'resident_num',
                'ceo_name',
                'pvcy_rep_name',
                'addr',
                'phone_num',
                'fax_num',
                'default_deposit_fee',
                'default_withdraw_fee',
                'head_office_fee',
                'withdraw_head_office_fee',
                'deposit_head_office_fee',
                'deposit_corp_type',
                'api_key',
                'virtual_account_id',
                'withdraw_type',
                'is_use_fee_operator',
                'is_use_deposit_operator',
                'is_use_withdraw_operator',
                'telegram_bot_id',
                'is_use_telegram_bot',
                'is_use_otp',
                'is_use_sign_key',
                'withdraw_fee_type',
                'is_use_corp_account',
                'corp_account_corp_type',
                'is_can_add_deposit',
                'deposit_corp_type',
                'withdraw_corp_type',
                'parent_id',
                'deposit_virtual_bank_code',
                'withdraw_virtual_bank_code',
                'withdraw_virtual_acct_num',
            ]
            let brand_sql = ` SELECT ${columns.join()} FROM brands `;
            brand_sql += ` WHERE (dns='${dns}' OR CONCAT(admin_a_record, '.', dns)='${dns}') AND is_delete=0 `;
            let brand = await pool.query(brand_sql);
            if (brand?.result.length == 0) {
                return response(req, res, -120, "등록된 도메인이 아닙니다.", false)
            }
            brand = brand?.result[0];
            brand['theme_css'] = JSON.parse(brand?.theme_css ?? '{}');
            brand['setting_obj'] = JSON.parse(brand?.setting_obj ?? '{}');
            brand['level_obj'] = JSON.parse(brand?.level_obj ?? '{}');
            brand['bizppurio_obj'] = JSON.parse(brand?.bizppurio_obj ?? '{}');

            brand['operator_list'] = getOperatorList(brand);
            let brands = await pool.query(`SELECT id, parent_id FROM brands `);
            brands = brands?.result;
            let childrens = findChildIds(brands, brand?.id);
            childrens.push(brand?.id)
            let parents = findParents(brands, brand)
            brand['childrens'] = childrens;
            brand['parents'] = parents;
            const token = await makeUserToken(brand, 'dns');

            res.cookie("dns", token, {
                httpOnly: true,
                maxAge: (60 * 60 * 1000) * 3,
                //sameSite: 'none', 
                //secure: true 
            });
            return response(req, res, 100, "success", brand);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
}

export default domainCtrl;