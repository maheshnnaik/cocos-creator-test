/****************************************************************************
 Copyright (c) 2016 Chukong Technologies Inc.
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

const RenderComponent = require('../../cocos2d/core/components/CCRenderComponent');
let EventTarget = require('../../cocos2d/core/event/event-target');
const Graphics = require('../../cocos2d/core/graphics/graphics');
const RenderFlow = require('../../cocos2d/core/renderer/render-flow');
const FLAG_POST_RENDER = RenderFlow.FLAG_POST_RENDER;

let ArmatureCache = require('./ArmatureCache');
let AttachUtil = require('./AttachUtil');

/**
 * @module dragonBones
 */

let DefaultArmaturesEnum = cc.Enum({ 'default': -1 });
let DefaultAnimsEnum = cc.Enum({ '<None>': 0 });
let DefaultCacheMode = cc.Enum({ 'REALTIME': 0 });

/**
 * !#en Enum for cache mode type.
 * !#zh Dragonbones????????????
 * @enum ArmatureDisplay.AnimationCacheMode
 */
let AnimationCacheMode = cc.Enum({
    /**
     * !#en The realtime mode.
     * !#zh ?????????????????????
     * @property {Number} REALTIME
     */
    REALTIME: 0,
    /**
     * !#en The shared cache mode.
     * !#zh ?????????????????????
     * @property {Number} SHARED_CACHE
     */
    SHARED_CACHE: 1,
    /**
     * !#en The private cache mode.
     * !#zh ?????????????????????
     * @property {Number} PRIVATE_CACHE
     */
    PRIVATE_CACHE: 2 
});

function setEnumAttr (obj, propName, enumDef) {
    cc.Class.Attr.setClassAttr(obj, propName, 'type', 'Enum');
    cc.Class.Attr.setClassAttr(obj, propName, 'enumList', cc.Enum.getList(enumDef));
}

/**
 * !#en
 * The Armature Display of DragonBones <br/>
 * <br/>
 * Armature Display has a reference to a DragonBonesAsset and stores the state for ArmatureDisplay instance,
 * which consists of the current pose's bone SRT, slot colors, and which slot attachments are visible. <br/>
 * Multiple Armature Display can use the same DragonBonesAsset which includes all animations, skins, and attachments. <br/>
 * !#zh
 * DragonBones ???????????? <br/>
 * <br/>
 * Armature Display ?????????????????????????????????????????????????????????????????????
 * ??????????????????????????????slot ????????????????????? slot attachments ?????????<br/>
 * ?????? Armature Display ??????????????????????????????????????????????????????????????????????????? attachments???<br/>
 *
 * @class ArmatureDisplay
 * @extends RenderComponent
 */
let ArmatureDisplay = cc.Class({
    name: 'dragonBones.ArmatureDisplay',
    extends: RenderComponent,

    editor: CC_EDITOR && {
        menu: 'i18n:MAIN_MENU.component.renderers/DragonBones',
        inspector: 'packages://inspector/inspectors/comps/skeleton2d.js',
    },
    
    statics: {
        AnimationCacheMode: AnimationCacheMode,
    },
    
    properties: {
        _factory: {
            default: null,
            type: dragonBones.CCFactory,
            serializable: false,
        },

        /**
         * !#en
         * The DragonBones data contains the armatures information (bind pose bones, slots, draw order,
         * attachments, skins, etc) and animations but does not hold any state.<br/>
         * Multiple ArmatureDisplay can share the same DragonBones data.
         * !#zh
         * ?????????????????????????????????????????????????????????slots??????????????????
         * attachments??????????????????????????????????????????????????????<br/>
         * ?????? ArmatureDisplay ????????????????????????????????????
         * @property {DragonBonesAsset} dragonAsset
         */
        dragonAsset: {
            default: null,
            type: dragonBones.DragonBonesAsset,
            notify () {
                this._refresh();
                if (CC_EDITOR) {
                    this._defaultArmatureIndex = 0;
                    this._animationIndex = 0;
                }
            },
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.dragon_bones_asset'
        },

        /**
         * !#en
         * The atlas asset for the DragonBones.
         * !#zh
         * ????????????????????? Atlas Texture ?????????
         * @property {DragonBonesAtlasAsset} dragonAtlasAsset
         */
        dragonAtlasAsset: {
            default: null,
            type: dragonBones.DragonBonesAtlasAsset,
            notify () {
                // parse the atlas asset data
                this._parseDragonAtlasAsset();
                this._refresh();
            },
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.dragon_bones_atlas_asset'
        },

        _armatureName: '',
        /**
         * !#en The name of current armature.
         * !#zh ????????? Armature ?????????
         * @property {String} armatureName
         */
        armatureName: {
            get () {
                return this._armatureName;
            },
            set (value) {
                this._armatureName = value;
                let animNames = this.getAnimationNames(this._armatureName);

                if (!this.animationName || animNames.indexOf(this.animationName) < 0) {
                    if (CC_EDITOR) {
                        this.animationName = animNames[0];
                    }
                    else {
                        // Not use default animation name at runtime
                        this.animationName = '';
                    }
                }

                if (this._armature && !this.isAnimationCached()) {
                    this._factory._dragonBones.clock.remove(this._armature);
                }

                this._refresh();

                if (this._armature && !this.isAnimationCached()) {
                    this._factory._dragonBones.clock.add(this._armature);
                }
                
            },
            visible: false
        },

        _animationName: '',
        /**
         * !#en The name of current playing animation.
         * !#zh ??????????????????????????????
         * @property {String} animationName
         */
        animationName: {
            get () {
                return this._animationName;
            },
            set (value) {
                this._animationName = value;
            },
            visible: false
        },

        /**
         * @property {Number} _defaultArmatureIndex
         */
        _defaultArmatureIndex: {
            default: 0,
            notify () {
                let armatureName = '';
                if (this.dragonAsset) {
                    let armaturesEnum;
                    if (this.dragonAsset) {
                        armaturesEnum = this.dragonAsset.getArmatureEnum();
                    }
                    if (!armaturesEnum) {
                        return cc.errorID(7400, this.name);
                    }

                    armatureName = armaturesEnum[this._defaultArmatureIndex];
                }

                if (armatureName !== undefined) {
                    this.armatureName = armatureName;
                }
                else {
                    cc.errorID(7401, this.name);
                }
            },
            type: DefaultArmaturesEnum,
            visible: true,
            editorOnly: true,
            animatable: false,
            displayName: "Armature",
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.armature_name'
        },

        // value of 0 represents no animation
        _animationIndex: {
            default: 0,
            notify () {
                if (this._animationIndex === 0) {
                    this.animationName = '';
                    return;
                }

                let animsEnum;
                if (this.dragonAsset) {
                    animsEnum = this.dragonAsset.getAnimsEnum(this.armatureName);
                }

                if (!animsEnum) {
                    return;
                }

                let animName = animsEnum[this._animationIndex];
                if (animName !== undefined) {
                    this.playAnimation(animName, this.playTimes);
                }
                else {
                    cc.errorID(7402, this.name);
                }
            },
            type: DefaultAnimsEnum,
            visible: true,
            editorOnly: true,
            animatable: false,
            displayName: 'Animation',
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.animation_name'
        },

        // Record pre cache mode.
        _preCacheMode: -1,
        _cacheMode: AnimationCacheMode.REALTIME,
        _defaultCacheMode: {
            default: 0,
            type: AnimationCacheMode,
            notify () {
                if (this._defaultCacheMode !== AnimationCacheMode.REALTIME) {
                    if (this._armature && !ArmatureCache.canCache(this._armature)) {
                        this._defaultCacheMode = AnimationCacheMode.REALTIME;
                        cc.warn("Animation cache mode doesn't support skeletal nesting");
                        return;
                    }
                }
                this.setAnimationCacheMode(this._defaultCacheMode);
            },
            editorOnly: true,
            visible: true,
            animatable: false,
            displayName: "Animation Cache Mode",
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.animation_cache_mode'
        },

        /**
         * !#en The time scale of this armature.
         * !#zh ????????????????????????????????????????????????
         * @property {Number} timeScale
         * @default 1
         */
        timeScale: {
            default: 1,
            notify () {
                if (this._armature && !this.isAnimationCached()) {
                    this._armature.animation.timeScale = this.timeScale;
                }  
            },
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.time_scale'
        },

        /**
         * !#en The play times of the default animation.
         *      -1 means using the value of config file;
         *      0 means repeat for ever
         *      >0 means repeat times
         * !#zh ?????????????????????????????????
         *      -1 ???????????????????????????????????????;
         *      0 ??????????????????
         *      >0 ??????????????????
         * @property {Number} playTimes
         * @default -1
         */
        playTimes: {
            default: -1,
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.play_times'
        },

        /**
         * !#en Indicates whether to enable premultiplied alpha.
         * You should disable this option when image's transparent area appears to have opaque pixels,
         * or enable this option when image's half transparent area appears to be darken.
         * !#zh ???????????????????????????
         * ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
         * @property {Boolean} premultipliedAlpha
         * @default false
         */
        premultipliedAlpha: {
            default: false,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.premultipliedAlpha'
        },
        
        /**
         * !#en Indicates whether open debug bones.
         * !#zh ???????????? bone ??? debug ?????????
         * @property {Boolean} debugBones
         * @default false
         */
        debugBones: {
            default: false,
            notify () {
                this._updateDebugDraw();
            },
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.debug_bones'
        },

        /**
         * !#en Enabled batch model, if skeleton is complex, do not enable batch, or will lower performance.
         * !#zh ?????????????????????????????????????????????????????????????????????????????????????????????????????????drawcall???????????????????????????cpu??????????????????
         * @property {Boolean} enableBatch
         * @default false
         */
        enableBatch: {
            default: false,
            notify () {
                this._updateBatch();
            },
            tooltip: CC_DEV && 'i18n:COMPONENT.dragon_bones.enabled_batch'
        },

        // DragonBones data store key.
        _armatureKey: "",

        // Below properties will effect when cache mode is SHARED_CACHE or PRIVATE_CACHE.
        // accumulate time
        _accTime: 0,
        // Play times counter
        _playCount: 0,
        // Frame cache
        _frameCache: null,
        // Cur frame
        _curFrame: null,
        // Playing flag
        _playing: false,
        // Armature cache
        _armatureCache: null,
    },

    ctor () {
        // Property _materialCache Use to cache material,since dragonBones may use multiple texture,
        // it will clone from the '_material' property,if the dragonbones only have one texture,
        // it will just use the _material,won't clone it.
        // So if invoke getMaterial,it only return _material,if you want to change all materialCache,
        // you can change materialCache directly.
        this._eventTarget = new EventTarget();
        this._materialCache = {};
        this._inited = false;
        this.attachUtil = new AttachUtil();
        this._factory = dragonBones.CCFactory.getInstance();
    },

    onLoad () {
        // Adapt to old code,remove unuse child which is created by old code.
        // This logic can be remove after 2.2 or later.
        let children = this.node.children;
        for (let i = 0, n = children.length; i < n; i++) {
            let child = children[i];
            let pos = child._name && child._name.search('CHILD_ARMATURE-');
            if (pos === 0) {
                child.destroy();
            }
        }
    },

    // if change use batch mode, just clear material cache
    _updateBatch () {
        let baseMaterial = this.getMaterial(0);
        if (baseMaterial) {
            baseMaterial.define('CC_USE_MODEL', !this.enableBatch);
        }
        this._materialCache = {};
    },

    // override base class _updateMaterial to set define value and clear material cache
    _updateMaterial () {
        let baseMaterial = this.getMaterial(0);
        if (baseMaterial) {
            baseMaterial.define('CC_USE_MODEL', !this.enableBatch);
            baseMaterial.define('USE_TEXTURE', true);
            
            let srcBlendFactor = this.premultipliedAlpha ? cc.gfx.BLEND_ONE : cc.gfx.BLEND_SRC_ALPHA;
            let dstBlendFactor = cc.gfx.BLEND_ONE_MINUS_SRC_ALPHA;

            baseMaterial.setBlend(
                true,
                cc.gfx.BLEND_FUNC_ADD,
                srcBlendFactor, srcBlendFactor,
                cc.gfx.BLEND_FUNC_ADD,
                dstBlendFactor, dstBlendFactor
            );
        }
        this._materialCache = {};
    },

    // override base class disableRender to clear post render flag
    disableRender () {
        this._super();
        this.node._renderFlag &= ~FLAG_POST_RENDER;
    },

    // override base class disableRender to add post render flag
    markForRender (enable) {
        this._super(enable);
        if (enable) {
            this.node._renderFlag |= FLAG_POST_RENDER;
        } else {
            this.node._renderFlag &= ~FLAG_POST_RENDER;
        }
    },

    _validateRender () {
        let texture = this.dragonAtlasAsset && this.dragonAtlasAsset.texture;
        if (!texture || !texture.loaded) {
            this.disableRender();
            return;
        }
        this._super();
    },

    __preload () {
        this._init();
    },

    _init () {
        if (this._inited) return;
        this._inited = true;
        
        this._resetAssembler();
        this._activateMaterial();
        this._parseDragonAtlasAsset();
        this._refresh();

        let children = this.node.children;
        for (let i = 0, n = children.length; i < n; i++) {
            let child = children[i];
            if (child && child._name === "DEBUG_DRAW_NODE") {
                child.destroy();
            }
        }
        this._updateDebugDraw();
    },

    /**
     * !#en
     * The key of dragonbones cache data, which is regard as 'dragonbonesName', when you want to change dragonbones cloth.
     * !#zh 
     * ?????????????????????key?????????????????????????????????????????????dragonbonesName??????
     * @method getArmatureKey
     * @return {String}
     * @example
     * let factory = dragonBones.CCFactory.getInstance();
     * let needChangeSlot = needChangeArmature.armature().getSlot("changeSlotName");
     * factory.replaceSlotDisplay(toChangeArmature.getArmatureKey(), "armatureName", "slotName", "displayName", needChangeSlot);
     */
    getArmatureKey () {
        return this._armatureKey;
    },

    /**
     * !#en
     * It's best to set cache mode before set property 'dragonAsset', or will waste some cpu time.
     * If set the mode in editor, then no need to worry about order problem.
     * !#zh 
     * ??????????????????????????????????????????'dragonAsset'???????????????????????????????????????????????????????????????
     * ???????????????????????????????????????????????????????????????????????????
     * 
     * @method setAnimationCacheMode
     * @param {AnimationCacheMode} cacheMode
     * @example
     * armatureDisplay.setAnimationCacheMode(dragonBones.ArmatureDisplay.AnimationCacheMode.SHARED_CACHE);
     */
    setAnimationCacheMode (cacheMode) {
        if (this._preCacheMode !== cacheMode) {
            this._cacheMode = cacheMode;
            this._buildArmature();

            if (this._armature && !this.isAnimationCached()) {
                this._factory._dragonBones.clock.add(this._armature);
            }            
        }
    },
    
    /**
     * !#en Whether in cached mode.
     * !#zh ?????????????????????????????????
     * @method isAnimationCached
     * @return {Boolean}
     */
    isAnimationCached () {
        if (CC_EDITOR) return false;
        return this._cacheMode !== AnimationCacheMode.REALTIME;
    },

    onEnable () {
        this._super();
        // If cache mode is cache, no need to update by dragonbones library.
        if (this._armature && !this.isAnimationCached()) {
            this._factory._dragonBones.clock.add(this._armature);
        }
    },

    onDisable () {
        this._super();
        // If cache mode is cache, no need to update by dragonbones library.
        if (this._armature && !this.isAnimationCached()) {
            this._factory._dragonBones.clock.remove(this._armature);
        }
    },

    _emitCacheCompleteEvent () {
        // Animation loop complete, the event diffrent from dragonbones inner event,
        // It has no event object.
        this._eventTarget.emit(dragonBones.EventObject.LOOP_COMPLETE);

        // Animation complete the event diffrent from dragonbones inner event,
        // It has no event object.
        this._eventTarget.emit(dragonBones.EventObject.COMPLETE);
    },

    update (dt) {
        if (!this.isAnimationCached()) return;
        if (!this._frameCache) return;

        let frameCache = this._frameCache;
        if (!frameCache.isInited()) {
            return;
        }
        
        let frames = frameCache.frames;
        if (!this._playing) {
            if (frameCache.isInvalid()) {
                frameCache.updateToFrame();
                this._curFrame = frames[frames.length - 1];
            }
            return;
        }

        let frameTime = ArmatureCache.FrameTime;

        // Animation Start, the event diffrent from dragonbones inner event,
        // It has no event object.
        if (this._accTime == 0 && this._playCount == 0) {
            this._eventTarget.emit(dragonBones.EventObject.START);
        }

        let globalTimeScale = dragonBones.timeScale;
        this._accTime += dt * this.timeScale * globalTimeScale;
        let frameIdx = Math.floor(this._accTime / frameTime);
        if (!frameCache.isCompleted) {
            frameCache.updateToFrame(frameIdx);
        }

        if (frameCache.isCompleted && frameIdx >= frames.length) {
            this._playCount ++;
            if ((this.playTimes > 0 && this._playCount >= this.playTimes)) {
                // set frame to end frame.
                this._curFrame = frames[frames.length - 1];
                this._accTime = 0;
                this._playing = false;
                this._playCount = 0;
                this._emitCacheCompleteEvent();
                return;
            }
            this._accTime = 0;
            frameIdx = 0;
            this._emitCacheCompleteEvent();
        }

        this._curFrame = frames[frameIdx];
    },

    onDestroy () {
        this._super();
        this._inited = false;

        if (!CC_EDITOR) {
            if (this._cacheMode === AnimationCacheMode.PRIVATE_CACHE) {
                this._armatureCache.dispose();
                this._armatureCache = null;
                this._armature = null;
            } else if (this._cacheMode === AnimationCacheMode.SHARED_CACHE) {
                this._armatureCache = null;
                this._armature = null;
            } else if (this._armature) {
                this._armature.dispose();
                this._armature = null;
            }
        } else {
            if (this._armature) {
                this._armature.dispose();
                this._armature = null;
            }
        }
    },

    _updateDebugDraw () {
        if (this.debugBones) {
            if (!this._debugDraw) {
                let debugDrawNode = new cc.PrivateNode();
                debugDrawNode.name = 'DEBUG_DRAW_NODE';
                let debugDraw = debugDrawNode.addComponent(Graphics);
                debugDraw.lineWidth = 1;
                debugDraw.strokeColor = cc.color(255, 0, 0, 255);
                
                this._debugDraw = debugDraw;
            }

            this._debugDraw.node.parent = this.node;
        }
        else if (this._debugDraw) {
            this._debugDraw.node.parent = null;
        }
    },

    _buildArmature () {
        if (!this.dragonAsset || !this.dragonAtlasAsset || !this.armatureName) return;

        // Switch Asset or Atlas or cacheMode will rebuild armature.
        if (this._armature) {
            // dispose pre build armature
            if (!CC_EDITOR) {
                if (this._preCacheMode === AnimationCacheMode.PRIVATE_CACHE) {
                    this._armatureCache.dispose();
                } else if (this._preCacheMode === AnimationCacheMode.REALTIME) {
                    this._armature.dispose();
                }
            } else {
                this._armature.dispose();
            }

            this._armatureCache = null;
            this._armature = null;
            this._displayProxy = null;
            this._frameCache = null;
            this._curFrame = null;
            this._playing = false;
            this._preCacheMode = null;
        }

        if (!CC_EDITOR) {
            if (this._cacheMode === AnimationCacheMode.SHARED_CACHE) {
                this._armatureCache = ArmatureCache.sharedCache;
            } else if (this._cacheMode === AnimationCacheMode.PRIVATE_CACHE) {
                this._armatureCache = new ArmatureCache;
                this._armatureCache.enablePrivateMode();
            }
        }

        let atlasUUID = this.dragonAtlasAsset._uuid;
        this._armatureKey = this.dragonAsset.init(this._factory, atlasUUID);

        if (this.isAnimationCached()) {
            this._armature = this._armatureCache.getArmatureCache(this.armatureName, this._armatureKey, atlasUUID);
            if (!this._armature) {
                // Cache fail,swith to REALTIME cache mode.
                this._cacheMode = AnimationCacheMode.REALTIME;
            } 
        } 
        
        this._preCacheMode = this._cacheMode;
        if (CC_EDITOR || this._cacheMode === AnimationCacheMode.REALTIME) {
            this._displayProxy = this._factory.buildArmatureDisplay(this.armatureName, this._armatureKey, "", atlasUUID);
            if (!this._displayProxy) return;
            this._displayProxy._ccNode = this.node;
            this._displayProxy.setEventTarget(this._eventTarget);
            this._armature = this._displayProxy._armature;
            this._armature.animation.timeScale = this.timeScale;
            // If change mode or armature, armature must insert into clock.
            // this._factory._dragonBones.clock.add(this._armature);
        }

        if (this._cacheMode !== AnimationCacheMode.REALTIME && this.debugBones) {
            cc.warn("Debug bones is invalid in cached mode");
        }

        if (this._armature) {
            let armatureData = this._armature.armatureData;
            let aabb = armatureData.aabb;
            this.node.setContentSize(aabb.width, aabb.height);
        }

        this._updateBatch();
        this.attachUtil.init(this);
        this.attachUtil._associateAttachedNode();

        if (this.animationName) {
            this.playAnimation(this.animationName, this.playTimes);
        }

        this.markForRender(true);
    },

    _parseDragonAtlasAsset () {
        if (this.dragonAtlasAsset) {
            this.dragonAtlasAsset.init(this._factory);
        }
    },

    _refresh () {
        this._buildArmature();

        if (CC_EDITOR) {
            // update inspector
            this._updateArmatureEnum();
            this._updateAnimEnum();
            this._updateCacheModeEnum();
            Editor.Utils.refreshSelectedInspector('node', this.node.uuid);
        }
    },

    _updateCacheModeEnum: CC_EDITOR && function () {
        if (this._armature) {
            setEnumAttr(this, '_defaultCacheMode', AnimationCacheMode);
        } else {
            setEnumAttr(this, '_defaultCacheMode', DefaultCacheMode);
        }
    },

    // update animation list for editor
    _updateAnimEnum: CC_EDITOR && function () {
        let animEnum;
        if (this.dragonAsset) {
            animEnum = this.dragonAsset.getAnimsEnum(this.armatureName);
        }
        // change enum
        setEnumAttr(this, '_animationIndex', animEnum || DefaultAnimsEnum);
    },

    // update armature list for editor
    _updateArmatureEnum: CC_EDITOR && function () {
        let armatureEnum;
        if (this.dragonAsset) {
            armatureEnum = this.dragonAsset.getArmatureEnum();
        }
        // change enum
        setEnumAttr(this, '_defaultArmatureIndex', armatureEnum || DefaultArmaturesEnum);
    },

    /**
     * !#en
     * Play the specified animation.
     * Parameter animName specify the animation name.
     * Parameter playTimes specify the repeat times of the animation.
     * -1 means use the value of the config file.
     * 0 means play the animation for ever.
     * >0 means repeat times.
     * !#zh 
     * ?????????????????????.
     * animName ??????????????????????????????
     * playTimes ??????????????????????????????
     * -1 ????????????????????????????????????
     * 0 ????????????????????????
     * >0 ???????????????????????????
     * @method playAnimation
     * @param {String} animName
     * @param {Number} playTimes
     * @return {dragonBones.AnimationState}
     */
    playAnimation (animName, playTimes) {
        
        this.playTimes = (playTimes === undefined) ? -1 : playTimes;
        this.animationName = animName;

        if (this.isAnimationCached()) {
            let cache = this._armatureCache.getAnimationCache(this._armatureKey, animName);
            if (!cache) {
                cache = this._armatureCache.initAnimationCache(this._armatureKey, animName);
            }
            if (cache) {
                this._accTime = 0;
                this._playCount = 0;
                this._frameCache = cache;
                if (this.attachUtil._hasAttachedNode()) {
                    this._frameCache.enableCacheAttachedInfo();
                }
                this._frameCache.updateToFrame(0);
                this._playing = true;
                this._curFrame = this._frameCache.frames[0];
            }
        } else {
            if (this._armature) {
                return this._armature.animation.play(animName, this.playTimes);
            }
        }
    },

    /**
     * !#en
     * Updating an animation cache to calculate all frame data in the animation is a cost in 
     * performance due to calculating all data in a single frame.
     * To update the cache, use the invalidAnimationCache method with high performance.
     * !#zh
     * ????????????????????????, ????????????????????????????????????????????????????????????????????????????????????????????????
     * ?????????????????????????????? invalidAnimationCache ??????????????????????????????
     * @method updateAnimationCache
     * @param {String} animName
     */
    updateAnimationCache (animName) {
        if (!this.isAnimationCached()) return;
        this._armatureCache.updateAnimationCache(this._armatureKey, animName);
    },

    /**
     * !#en
     * Invalidates the animation cache, which is then recomputed on each frame..
     * !#zh
     * ?????????????????????????????????????????????????????????
     * @method invalidAnimationCache
     */
    invalidAnimationCache () {
        if (!this.isAnimationCached()) return;
        this._armatureCache.invalidAnimationCache(this._armatureKey);
    },

    /**
     * !#en
     * Get the all armature names in the DragonBones Data.
     * !#zh
     * ?????? DragonBones ?????????????????? armature ??????
     * @method getArmatureNames
     * @returns {Array}
     */
    getArmatureNames () {
        let dragonBonesData = this._factory.getDragonBonesData(this._armatureKey);
        return (dragonBonesData && dragonBonesData.armatureNames) || [];
    },

    /**
     * !#en
     * Get the all animation names of specified armature.
     * !#zh
     * ??????????????? armature ????????????????????????
     * @method getAnimationNames
     * @param {String} armatureName
     * @returns {Array}
     */
    getAnimationNames (armatureName) {
        let ret = [];
        let dragonBonesData = this._factory.getDragonBonesData(this._armatureKey);
        if (dragonBonesData) {
            let armatureData = dragonBonesData.getArmature(armatureName);
            if (armatureData) {
                for (let animName in armatureData.animations) {
                    if (armatureData.animations.hasOwnProperty(animName)) {
                        ret.push(animName);
                    }
                }
            }
        }
        return ret;
    },

    /**
     * !#en
     * Add event listener for the DragonBones Event, the same to addEventListener.
     * !#zh
     * ?????? DragonBones ????????????????????? addEventListener ???????????????
     * @method on
     * @param {String} type - A string representing the event type to listen for.
     * @param {Function} listener - The callback that will be invoked when the event is dispatched.
     * @param {Event} listener.event event
     * @param {Object} [target] - The target (this object) to invoke the callback, can be null
     */
    on (eventType, listener, target) {
        this.addEventListener(eventType, listener, target);
    },

    /**
     * !#en
     * Remove the event listener for the DragonBones Event, the same to removeEventListener.
     * !#zh
     * ?????? DragonBones ????????????????????? removeEventListener ???????????????
     * @method off
     * @param {String} type - A string representing the event type to listen for.
     * @param {Function} [listener]
     * @param {Object} [target]
     */
    off (eventType, listener, target) {
        this.removeEventListener(eventType, listener, target);
    },

    /**
     * !#en
     * Add DragonBones one-time event listener, the callback will remove itself after the first time it is triggered.
     * !#zh
     * ?????? DragonBones ??????????????????????????????????????????????????????????????????????????????
     * @method once
     * @param {String} type - A string representing the event type to listen for.
     * @param {Function} listener - The callback that will be invoked when the event is dispatched.
     * @param {Event} listener.event event
     * @param {Object} [target] - The target (this object) to invoke the callback, can be null
     */
    once (eventType, listener, target) {
        this._eventTarget.once(eventType, listener, target);
    },

    /**
     * !#en
     * Add event listener for the DragonBones Event.
     * !#zh
     * ?????? DragonBones ??????????????????
     * @method addEventListener
     * @param {String} type - A string representing the event type to listen for.
     * @param {Function} listener - The callback that will be invoked when the event is dispatched.
     * @param {Event} listener.event event
     * @param {Object} [target] - The target (this object) to invoke the callback, can be null
     */
    addEventListener (eventType, listener, target) {
        this._eventTarget.on(eventType, listener, target);
    },

    /**
     * !#en
     * Remove the event listener for the DragonBones Event.
     * !#zh
     * ?????? DragonBones ??????????????????
     * @method removeEventListener
     * @param {String} type - A string representing the event type to listen for.
     * @param {Function} [listener]
     * @param {Object} [target]
     */
    removeEventListener (eventType, listener, target) {
        this._eventTarget.off(eventType, listener, target);
    },

    /**
     * !#en
     * Build the armature for specified name.
     * !#zh
     * ????????????????????? armature ??????
     * @method buildArmature
     * @param {String} armatureName
     * @param {Node} node
     * @return {dragonBones.ArmatureDisplay}
     */
    buildArmature (armatureName, node) {
        return this._factory.createArmatureNode(this, armatureName, node);
    },

    /**
     * !#en
     * Get the current armature object of the ArmatureDisplay.
     * !#zh
     * ?????? ArmatureDisplay ??????????????? Armature ??????
     * @method armature
     * @returns {Object}
     */
    armature () {
        return this._armature;
    },
});

/**
 * !#en
 * Animation start play.
 * !#zh
 * ?????????????????????
 *
 * @event dragonBones.EventObject.START
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 */

/**
 * !#en
 * Animation loop play complete once.
 * !#zh
 * ?????????????????????????????????
 *
 * @event dragonBones.EventObject.LOOP_COMPLETE
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 */

/**
 * !#en
 * Animation play complete.
 * !#zh
 * ?????????????????????
 *
 * @event dragonBones.EventObject.COMPLETE
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 */

/**
 * !#en
 * Animation fade in start.
 * !#zh
 * ?????????????????????
 *
 * @event dragonBones.EventObject.FADE_IN
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 */

/**
 * !#en
 * Animation fade in complete.
 * !#zh
 * ?????????????????????
 *
 * @event dragonBones.EventObject.FADE_IN_COMPLETE
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 */

/**
 * !#en
 * Animation fade out start.
 * !#zh
 * ?????????????????????
 *
 * @event dragonBones.EventObject.FADE_OUT
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 */

/**
 * !#en
 * Animation fade out complete.
 * !#zh
 * ?????????????????????
 *
 * @event dragonBones.EventObject.FADE_OUT_COMPLETE
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 */

/**
 * !#en
 * Animation frame event.
 * !#zh
 * ??????????????????
 *
 * @event dragonBones.EventObject.FRAME_EVENT
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {String} [callback.event.name]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 * @param {dragonBones.Bone} [callback.event.bone]
 * @param {dragonBones.Slot} [callback.event.slot]
 */

/**
 * !#en
 * Animation frame sound event.
 * !#zh
 * ????????????????????????
 *
 * @event dragonBones.EventObject.SOUND_EVENT
 * @param {String} type - A string representing the event type to listen for.
 * @param {Function} callback - The callback that will be invoked when the event is dispatched.
 *                              The callback is ignored if it is a duplicate (the callbacks are unique).
 * @param {dragonBones.EventObject} [callback.event]
 * @param {String} [callback.event.type]
 * @param {String} [callback.event.name]
 * @param {dragonBones.Armature} [callback.event.armature]
 * @param {dragonBones.AnimationState} [callback.event.animationState]
 * @param {dragonBones.Bone} [callback.event.bone]
 * @param {dragonBones.Slot} [callback.event.slot]
 */

module.exports = dragonBones.ArmatureDisplay = ArmatureDisplay;
