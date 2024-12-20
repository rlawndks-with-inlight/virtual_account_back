import { readPool } from "../../config/db-pool.js";
import virtualAccountCtrl from "../../controllers/virtual_account.controller.js";
import _ from "lodash";

export const destructAutoVirtualAcct = async () => {
    try {
        let sql = ` SELECT virtual_accounts.*, brands.destruct_auto_virtual_acct_minute FROM virtual_accounts `;
        sql += ` LEFT JOIN brands ON virtual_accounts.brand_id=brands.id `;
        sql += ` WHERE brands.is_use_destruct_auto_virtual_acct=1 `;
        sql += ` AND virtual_accounts.status=0 AND virtual_accounts.is_delete=0 `;
        sql += ` AND ( `;
        //
        sql += ` virtual_accounts.updated_at < DATE_SUB(NOW(), INTERVAL brands.destruct_auto_virtual_acct_minute MINUTE) `
        sql += ` OR `
        sql += ` virtual_accounts.id IN (SELECT virtual_account_id FROM deposits WHERE pay_type=0 GROUP BY virtual_account_id) `;
        //
        sql += ` ) `;
        sql += ` ORDER BY virtual_accounts.id ASC `;
        console.log(sql)
        let auto_delete_virtual_accts = await readPool.query(sql);
        auto_delete_virtual_accts = auto_delete_virtual_accts[0];
        if (auto_delete_virtual_accts.length > 0) {
            let brand_id_list = auto_delete_virtual_accts.map(itm => itm?.brand_id);
            brand_id_list = new Set(brand_id_list);
            brand_id_list = [...brand_id_list];
            let brands = await readPool.query(`SELECT * FROM brands WHERE id IN (${brand_id_list.join()})`);
            brands = brands[0];

            for (var i = 0; i < auto_delete_virtual_accts.length; i++) {
                let brand = _.find(brands, { id: parseInt(auto_delete_virtual_accts[i]?.brand_id) })
                deleteVirtualAccounts(auto_delete_virtual_accts[i], brand);
            }
        }

    } catch (err) {
        console.log(err);
    }
}
const deleteVirtualAccounts = async (virtual_acct = {}, dns_data = {}) => {
    try {
        const result = await virtualAccountCtrl.remove({
            params: {
                id: virtual_acct?.id
            },
            IS_RETURN: true,
            dns_data: dns_data,
        });
    } catch (err) {
        console.log(err?.response?.data);
    }
}