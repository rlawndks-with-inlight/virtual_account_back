'use strict';
import _ from "lodash";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, response, setDepositAmountSetting, settingFiles, setWithdrawAmountSetting } from "../utils.js/util.js";
import 'dotenv/config';
import { asd_list } from "../asd.js";
import xlsx from 'xlsx';
import axios from "axios";
import { readPool, writePool } from "../config/db-pool.js";

const utilCtrl = {
    setting: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            let data = {};
            let deposit_api_result = await corpApi.bank.list({
                dns_data: decode_dns,
                decode_user,
                pay_type: 'deposit',
            })
            if (deposit_api_result.code != 100) {
                return response(req, res, -100, (deposit_api_result?.message || "서버 에러 발생"), false)
            }
            data['deposit'] = deposit_api_result?.data;
            let withdraw_api_result = await corpApi.bank.list({
                dns_data: decode_dns,
                decode_user,
                pay_type: 'withdraw',
            })
            if (withdraw_api_result.code != 100) {
                return response(req, res, -100, (withdraw_api_result?.message || "서버 에러 발생"), false)
            }
            data['withdraw'] = withdraw_api_result?.data;
            return response(req, res, 100, "success", data);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeStatus: async (req, res, next) => {
        try {

            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { table, column_name } = req.params;
            const { value, id } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let result = await writePool.query(`UPDATE ${table} SET ${column_name}=? WHERE id=?`, [value, id]);
            return response(req, res, 100, "success", {});
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

const insertCooconDeposit = async () => { //쿠콘 입금 누락건 추가
    let start_id = 508549;
    try {
        console.log(asd_list.length)
        let insert_list = [];
        for (var i = asd_list.length - 1; i >= 0; i--) {
            insert_list.push([
                start_id,
                76,
                0,
                '089',
                '70029000000176',
                '이지피쥐',
                parseInt(asd_list[i][6]),
                parseInt(asd_list[i][6]),
                `${asd_list[i][2].replaceAll('-', '')}120000` + asd_list[i][4],
                asd_list[i][5],
                1,
                `${asd_list[i][2]} 12:00:00`,
                `${asd_list[i][2]} 12:00:00`,
            ])
            start_id++;
        }
        let key_list = [
            'id',
            'brand_id',
            'pay_type',
            'virtual_bank_code',
            'virtual_acct_num',
            'virtual_acct_name',
            'amount',
            'expect_amount',
            'trx_id',
            'deposit_acct_name',
            'is_type_withdraw_acct',
            'created_at',
            'updated_at',
        ]
        let result = await writePool.query(`INSERT INTO deposits (${key_list.join()}) VALUES ?`, [insert_list]);
    } catch (err) {
        console.log(err);
    }
}
const getExcel = (name, num = 0) => {
    const workbook = xlsx.readFile(name); // 액샐 파일 읽어오기
    const firstSheetName = workbook.SheetNames[num]; // 첫 번째 시트 이름 가져오기
    const firstShee = workbook.Sheets[firstSheetName]; // 시트 이름을 이용해 엑셀 파일의 첫 번째 시트 가져오기
    const excel_list = xlsx.utils.sheet_to_json(firstShee);
    return excel_list;
}
const adsadsadsad = async () => {
    try {
        let excel_list = getExcel('./icb누락.xlsx');
        console.log(excel_list)
        for (var i = 0; i < excel_list.length; i++) {
            if (excel_list[i]['거래상태'] == '결제완료') {
                let result = await axios.post(`http://localhost:2500/api/push/icb`, {
                    mid: 'M00000000008',
                    memKey: excel_list[i]['VA번호'],
                    partnerTrxNo: excel_list[i]['파트너사거래번호'],
                    payCmpDts: excel_list[i]['완료일시'].replaceAll(' ', '').replaceAll(':', '').replaceAll('-', ''),
                    realTrxAmt: excel_list[i]['거래금액'],
                })
                console.log(result);
            }
        }
    } catch (err) {
        console.log(err);
    }
}
const processAmount = async () => {
    return;
    try {
        let brands = await readPool.query(`SELECT * FROM brands WHERE id IN (122, 123)`);
        brands = brands[0];

        let users = await readPool.query(`SELECT * FROM users WHERE brand_id IN (122, 123)`);
        users = users[0];

        let update_list = [];
        for (var i = 0; i < brands.length; i++) {
            let brand = brands[i];
            let deposits = await readPool.query(`SELECT * FROM deposits WHERE brand_id=${brand?.id} ORDER BY id DESC`);
            deposits = deposits[0];
            console.log(deposits.length);
            for (var j = 0; j < deposits.length; j++) {
                let deposit = deposits[j];
                let obj = {
                    top_offer5_id: null,
                    top_offer5_fee: 0,
                    top_offer5_amount: 0,
                    top_offer4_id: null,
                    top_offer4_fee: 0,
                    top_offer4_amount: 0,
                    top_offer3_id: null,
                    top_offer3_fee: 0,
                    top_offer3_amount: 0,
                    top_offer2_id: null,
                    top_offer2_fee: 0,
                    top_offer2_amount: 0,
                    top_offer1_id: null,
                    top_offer1_fee: 0,
                    top_offer1_amount: 0,
                    top_offer0_id: null,
                    top_offer0_fee: 0,
                    top_offer0_amount: 0,
                };
                let id = deposit?.id;
                if (deposit?.pay_type == 0 && deposit?.deposit_status == 0) {
                    let result = await setDepositAmountSetting(deposit?.amount, _.find(users, { id: deposit?.mcht_id }), brand);
                    let filtered_obj = _.pickBy(result, (value, key) => _.includes(key, 'top_offer'));
                    obj = {
                        ...obj,
                        ...filtered_obj,
                    }
                    update_list.push({
                        obj,
                        id,
                    })
                }
                if ([5, 20].includes(deposit?.pay_type) && deposit?.withdraw_status == 0) {
                    let result = await setWithdrawAmountSetting(Math.abs(deposit?.amount + deposit?.withdraw_fee), _.find(users, { id: deposit?.user_id }), brand);
                    let filtered_obj = _.pickBy(result, (value, key) => _.includes(key, 'top_offer'));
                    obj = {
                        ...obj,
                        ...filtered_obj,
                    }
                    update_list.push({
                        obj,
                        id,
                    })
                }
                if (j % 100 == 0) {
                    console.log(update_list[update_list.length - 1])
                    console.log(j);
                }
            }
        }
        console.log('######')
        console.log(update_list.length);
        for (var i = 0; i < update_list.length; i++) {
            let result = await updateQuery(`deposits`, update_list[i].obj, update_list[i].id);
            if (i % 100 == 0) {
                console.log('######')
                console.log(i);
            }
        }
    } catch (err) {

    }
}

export default utilCtrl;
