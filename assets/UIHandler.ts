// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, inspector, property} = cc._decorator;

@ccclass()
@inspector('packages://inspector/inspectors/comps/ccwidget.js')
export default class UIHandler extends cc.Widget {

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {
    //     const standardRatio = cc.view.getDesignResolutionSize().width / cc.view.getDesignResolutionSize().height; // standard aspect ratio, the aspect ratio is almost iPhone6 (landscape), generally as a standard design draft   const screenSize = cc.view .getFrameSize(); 
    //     const currentRatio = window.innerWidth / window.innerHeight; // aspect ratio 
    //     // a square screen, which means iPad or the like. 
    //     if (currentRatio <= standardRatio) {
    //         // adjust y
            
    //         // cc.Canvas.instance.fitHeight = false;
    //         // cc.Canvas.instance.fitWidth = true;
    //     } else {
    //         // Longer screen means ipx. Too long, the height appears small, so the priority is to fit the height
    //         // adjust x

    //         // cc.Canvas.instance.fitWidth = false;
    //         // cc.Canvas.instance.fitHeight = true;
    //     }
    // }

    start () {

    }
    
    
    // update (dt) {}
}
