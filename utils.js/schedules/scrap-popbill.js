import popbill from 'popbill';

export const popbillScraping = async () => {
    try {
        console.log(123)
        const popbill_func = popbill.config({
            // 링크아이디
            LinkID: 'TESTER',
            // 비밀키
            SecretKey: 'SwWxqU+0TErBXy/9TVjIPEnI0VTUMMSQZtJf3Ed8q3T=',
            // 연동환경 설정, true-테스트, false-운영(Production), (기본값:true)
            IsTest: true,
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
        let result = popbill_func.listBankAccount('1648702282', '0081', '82491001925104')
        console.log(result)
    } catch (err) {
        console.log(err);
    }
}
const popbillFunc = () => {

}