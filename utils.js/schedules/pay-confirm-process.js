import _ from "lodash";
import { pool } from "../../config/db.js";
import corpApi from "../corp-util/index.js";
import { generateRandomString } from "../util.js";
import { updateQuery } from "../query-util.js";

//무기명관련 결제완료처리하기
export const payConfirmProcess = async () => {
    try {
        let brands = await pool.query(`SELECT id FROM brands WHERE deposit_process_type=1`);
        brands = brands?.result;
        let brand_ids = brands.map(el => {
            return el?.id
        })
        if (brand_ids.length > 0) {
            let deposits = await pool.query(`SELECT id, brand_id, virtual_account_id, amount FROM deposits WHERE brand_id IN (${brand_ids.join()}) AND deposit_status=0 AND is_pay_confirm=0 AND pay_type=0 ORDER BY id ASC`);
            deposits = deposits?.result;
            console.log(deposits);
            let virtual_account_ids = deposits.map(el => {
                return el?.virtual_account_id
            })
            virtual_account_ids = new Set(virtual_account_ids);
            virtual_account_ids = [...virtual_account_ids];
            let virtual_accounts = [];
            if (virtual_account_ids.length > 0) {
                virtual_accounts = await pool.query(`SELECT id, ci FROM virtual_accounts WHERE id IN (${virtual_account_ids.join()})`);
                virtual_accounts = virtual_accounts?.result;
            }
            for (var i = 0; i < deposits.length; i++) {
                processConfirm(
                    deposits[i],
                    _.find(virtual_accounts, { id: deposits[i]?.virtual_account_id }),
                    _.find(brands, { id: deposits[i]?.brand_id }),
                )
            }
        }
    } catch (err) {
        console.log(err);
    }
}
const processConfirm = async (deposit, virtual_account, decode_dns) => {
    let trx_id = `pay${decode_dns?.id}${virtual_account?.id ?? generateRandomString(6)}${new Date().getTime()}`;
    let api_result = await corpApi.deposit.request({
        pay_type: 'deposit',
        dns_data: decode_dns,
        ci: virtual_account?.ci,
        amount: deposit?.amount,
        trx_id,
        //name: virtual_account?.deposit_acct_name,
    });
    if (api_result?.code > 0) {
        let update_deposit = await updateQuery(`deposits`, {
            is_pay_confirm: 1,
        }, deposit?.id)
    }

}