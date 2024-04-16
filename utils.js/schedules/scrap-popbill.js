import popbill from 'popbill';
import { returnMoment } from '../function.js';
import 'dotenv/config';

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
    search: (data) => {
        let {
            job_id,
            type = 'I',
        } = data;
        return new Promise((resolve, reject) => {
            popbill_func.search(
                BUSINESS_NUM,
                job_id,
                function (response) {
                    console.log(1)
                    resolve(response);
                },
                function (err) {
                    console.log(2)
                    reject(err);
                },)
        });
    }
}

export const popbillScraping = async () => {
    try {

        let corp_account_list = await popbillFunc.listBankAccount();

        for (var i = 0; i < corp_account_list.length; i++) {
            let {
                bankCode,
                accountNumber,
            } = corp_account_list[i];
            let bank_code = bankCode;
            let acct_num = accountNumber;
            let s_dt = returnMoment().substring(0, 10).replaceAll('-', '');
            let e_dt = returnMoment().substring(0, 10).replaceAll('-', '');
            let job_id = await popbillFunc.requestJob({
                bank_code,
                acct_num,
                s_dt,
                e_dt,
            })
            console.log(job_id)
            let deposit_list = await popbillFunc.search({
                job_id,
            })
            console.log(deposit_list)
        }
    } catch (err) {
        console.log(err);
    }
}
