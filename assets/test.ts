// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {

    // LIFE-CYCLE CALLBACKS:

    @property(cc.Node)
    bg: cc.Node = null;

    @property(cc.Node)
    button: cc.Node = null;
    onLoad() {
        // const standardRatio = cc.view.getDesignResolutionSize().width / cc.view.getDesignResolutionSize().height; // standard aspect ratio, the aspect ratio is almost iPhone6 (landscape), generally as a standard design draft   const screenSize = cc.view .getFrameSize(); 
        // const currentRatio = window.innerWidth / window.innerHeight; // aspect ratio 
        // console.log(cc.view.getCanvasSize());
        // a square screen, which means iPad or the like. 
        // if (currentRatio <= standardRatio) {
            // cc.Canvas.instance.fitHeight = false;
            // cc.Canvas.instance.fitWidth = true;
            // this.node.y = (window.innerHeight - (this.node.height / 2)) - this.button.getComponent(cc.Widget).top;
            
        //     this.button.getComponent(cc.Widget).top = this.getTopValue();
        //     console.log(this.button.getComponent(cc.Widget).top, this.button.y);
        // } else {
            // Longer screen means ipx. Too long, the height appears small, so the priority is to fit the height
            // cc.Canvas.instance.fitWidth = false;
            // cc.Canvas.instance.fitHeight = true;
            // this.node.x = (window.innerWidth - (this.node.width / 2)) - this.button.getComponent(cc.Widget).right;
        //     this.button.getComponent(cc.Widget).right = this.getRightValue();
        //     console.log(this.button.getComponent(cc.Widget).right, this.button.x);
        // }
        // console.log("fit-height: ", cc.Canvas.instance.fitHeight, "fit-width: ", cc.Canvas.instance.fitWidth);
    
    }

    getTopValue(){
        var top = this.button.getComponent(cc.Widget).top;
        var diffHeight = (window.innerHeight * window.devicePixelRatio) / 2 - (cc.view.getDesignResolutionSize().height / 2);
        console.log("diff Height: ", diffHeight);
        return (top - diffHeight + (this.button.height / 2));
    }
    getRightValue(){
        var right = this.button.getComponent(cc.Widget).right;
        var diffWidth = ((window.innerWidth * window.devicePixelRatio) - cc.view.getDesignResolutionSize().width) / 2;
        console.log("diff Width: ", diffWidth);
        // return (right + diffWidth);
        if(diffWidth <= 0){
            return (right + diffWidth);
        }
        else{
            return (right - diffWidth + (this.button.width / 2));
        }
    }

    start() {

    }

    // update (dt) {}
}
