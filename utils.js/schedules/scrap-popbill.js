import popbill from 'popbill';
import { differenceSecondTwoDate, returnMoment } from '../function.js';
import 'dotenv/config';
import { pool } from '../../config/db.js';
import { updateQuery } from '../query-util.js';
import axios from 'axios';

popbill.config({
    // 링크아이디
    LinkID: process.env.POPBILL_LINK_ID,
    // 비밀키
    SecretKey: `${process.env.POPBILL_SECRET_KEY}=`,
    // 연동환경 설정, true-테스트, false-운영(Production), (기본값:true)
    IsTest: false,
    // 통신 IP 고정, true-사용, false-미사용, (기본값:false)
    IPRestrictOnOff: false,
    // 팝빌 API 서비스 고정 IP 사용여부, 기본값(false)
    UseStaticIP: false,
    // 로컬시스템 시간 사용여부, true-사용, false-미사용, (기본값:true)
    UseLocalTimeYN: true,
    defaultErrorHandler: function (Error) {
        console.log('Error Occur : [' + Error.code + '] ' + Error.message);
    }
});
export const popbill_func = popbill.EasyFinBankService();
const BUSINESS_NUM = '1648702282';

export const popbillFunc = {
    listBankAccount: () => {
        return new Promise((resolve, reject) => {
            popbill_func.listBankAccount(
                BUSINESS_NUM,
                function (response) {
                    resolve(response);
                },
                function (err) {
                    reject(err);
                },)
        });
    },
    requestJob: (data) => {
        let {
            bank_code,
            acct_num,
            s_dt,
            e_dt,
        } = data;
        return new Promise((resolve, reject) => {
            popbill_func.requestJob(
                BUSINESS_NUM,
                bank_code,
                acct_num,
                s_dt,
                e_dt,
                function (response) {
                    resolve(response);
                },
                function (err) {
                    reject(err);
                },)
        });
    },
    getJobState: (data) => {
        let {
            job_id,
        } = data;
        return new Promise((resolve, reject) => {
            popbill_func.getJobState(
                BUSINESS_NUM,
                job_id,
                function (response) {
                    resolve(response);
                },
                function (err) {
                    reject(err);
                },)
        });
    },
    search: (data) => {
        let {
            job_id,
            type = 'I',
        } = data;
        return new Promise((resolve, reject) => {
            popbill_func.search(
                BUSINESS_NUM,
                job_id,
                type,
                '',
                1,
                500,
                'D',
                function (response) {
                    resolve(response);
                },
                function (err) {
                    reject(err);
                },)
        });
    }
}

export const popbillScraping = async () => {
    try {
        let corp_account_list = await popbillFunc.listBankAccount();
        for (var i = 0; i < corp_account_list.length; i++) {
            processCorpAccount(corp_account_list[i])
        }
    } catch (err) {
        console.log(err);
    }
}
popbillScraping();
const processCorpAccount = async (corp_account_item = {}) => {
    try {
        let {
            bankCode,
            accountNumber,
        } = corp_account_item;

        let bank_code = bankCode;
        let acct_num = accountNumber;
        let s_dt = returnMoment().substring(0, 10).replaceAll('-', '');
        let e_dt = returnMoment().substring(0, 10).replaceAll('-', '');
        let corp_account = await pool.query(`SELECT * FROM corp_accounts WHERE acct_num=? AND status=0 `, [
            acct_num
        ])
        corp_account = corp_account?.result[0];
        if (!corp_account) {
            return;
        }
        let job_id = '';
        if (
            corp_account?.job_id && corp_account?.jod_id_date &&
            differenceSecondTwoDate(returnMoment(), corp_account?.jod_id_date) < 60 * 59 &&
            corp_account?.jod_id_date?.substring(0, 10) == returnMoment().substring(0, 10)
        ) {//job_id가 유효한지
            job_id = corp_account?.job_id;
        } else {
            job_id = await popbillFunc.requestJob({
                bank_code,
                acct_num,
                s_dt,
                e_dt,
            })
            let update_job_id = await updateQuery('corp_accounts', {
                job_id,
                jod_id_date: returnMoment(),
            }, corp_account?.id)
        }
        let job_state = await popbillFunc.getJobState({
            job_id,
        })
        if (job_state?.jobState == 3) {
            let deposit_list = await popbillFunc.search({
                job_id,
            })
            deposit_list = deposit_list?.list;
            let deposit_push_list = [];
            for (var i = 0; i < deposit_list.length; i++) {
                if (deposit_list[i]?.tid == corp_account?.process_tid) {
                    break;
                }
                deposit_push_list.push({
                    ...deposit_list[i],
                    acctNo: acct_num,
                    finCode: corp_account?.bank_code
                });
            }
            for (var i = 0; i < deposit_push_list.length; i++) {
                deposit_push_list[i] = depositItemProcess(deposit_push_list[i], bank_code,);
            }

            deposit_push_list.reverse();
            let { data: response } = await axios.post(`${process.env.API_URL}/api/push/popbill/${corp_account?.brand_id}`, {
                list: deposit_push_list,
            });
            if (response == '0000') {
                let update_corp_account = await updateQuery('corp_accounts', {
                    process_tid: deposit_push_list[deposit_push_list.length - 1]?.trxId,
                }, corp_account?.id);
            }
            //조회 완료후 그다음 시퀀스
        }
    } catch (err) {
        console.log(err);
    }
}
const depositItemProcess = (item_ = {}, bank_code) => {
    let item = item_;
    let obj = {
        acctNo: item?.acctNo,
        finCode: item?.finCode,
        tranDate: item?.trdt.substring(0, 8),
        tranTime: item?.trdt.substring(8, 16),
        depositAmnt: item?.accIn,
        balance: item?.balance,
        tranName: item?.remark1,
        tranDetail: item?.remark2,
        memo: item?.remark3,
        recvAccntNo: '',
        trxId: item?.tid,
    }
    return obj;
}