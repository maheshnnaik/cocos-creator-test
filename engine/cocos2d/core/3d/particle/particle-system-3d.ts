/****************************************************************************
 Copyright (c) 2019 Xiamen Yaji Software Co., Ltd.

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

import { Mat4, pseudoRandom, Quat, randomRangeInt, Vec2, Vec3 } from '../../value-types';
import { INT_MAX } from '../../value-types/utils';
import Material from '../../assets/material/CCMaterial';
import ColorOverLifetimeModule from './animator/color-overtime';
import CurveRange, { Mode }from './animator/curve-range';
import ForceOvertimeModule from './animator/force-overtime';
import GradientRange from './animator/gradient-range';
import LimitVelocityOvertimeModule from './animator/limit-velocity-overtime';
import RotationOvertimeModule from './animator/rotation-overtime';
import SizeOvertimeModule from './animator/size-overtime';
import TextureAnimationModule from './animator/texture-animation';
import VelocityOvertimeModule from './animator/velocity-overtime';
import Burst from './burst';
import ShapeModule from './emitter/shape-module';
import { RenderMode, Space } from './enum';
import { particleEmitZAxis } from './particle-general-function';
import TrailModule from './renderer/trail';
import Mesh from '../../mesh/CCMesh';

const { ccclass, menu, property, executeInEditMode, executionOrder} = require('../../platform/CCClassDecorator')
const RenderComponent = require('../../components/CCRenderComponent');

const _world_mat = new Mat4();
const _module_props = CC_EDITOR && [
    "_colorOverLifetimeModule",
    "_shapeModule",
    "_sizeOvertimeModule",
    "_velocityOvertimeModule",
    "_forceOvertimeModule",
    "_limitVelocityOvertimeModule",
    "_rotationOvertimeModule",
    "_textureAnimationModule",
    "_trailModule"
]

/**
 * !#en The ParticleSystem3D Component.
 * !#zh 3D ????????????
 * @class ParticleSystem3D
 * @extends RenderComponent
 */
@ccclass('cc.ParticleSystem3D')
@menu('i18n:MAIN_MENU.component.renderers/ParticleSystem3D')
@executionOrder(99)
@executeInEditMode
export default class ParticleSystem3D extends RenderComponent {
    /**
     * !#en The run time of particle.
     * !#zh ????????????????????????
     * @property {Number} duration
     */
    @property
    duration = 5.0;

    @property
    _capacity = 100;
    /**
     * !#en The maximum number of particles that a particle system can generate.
     * !#zh ??????????????????????????????????????????
     * @property {Number} capacity
     */
    @property
    get capacity () {
        return this._capacity;
    }

    set capacity (val) {
        this._capacity = val;
        if (this._assembler) {
            this._assembler.setCapacity(this._capacity);
        }
    }

    /**
     * !#en Whether the particle system loops.
     * !#zh ??????????????????????????????
     * @property {Boolean} loop
     */
    @property
    loop = true;

    /**
     * !#en Whether the particles start playing automatically after loaded.
     * !#zh ?????????????????????????????????????????????
     * @property {Boolean} playOnAwake
     */
    @property({
        animatable: false
    })
    playOnAwake = true;

    @property
    _prewarm = false;
    /**
     * !#en When selected, the particle system will start playing after one round has been played (only effective when loop is enabled).
     * !#zh ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
     * @property {Boolean} prewarm
     */
    @property({
        animatable: false
    })
    get prewarm () {
        return this._prewarm;
    }

    set prewarm (val) {
        if (val === true && this.loop === false) {
            // console.warn('prewarm only works if loop is also enabled.');
        }
        this._prewarm = val;
    }

    @property
    _simulationSpace = Space.Local;
    /**
     * !#en The coordinate system in which the particle system is located.<br>
     * World coordinates (does not change when the position of other objects changes)<br>
     * Local coordinates (moving as the position of the parent node changes)<br>
     * Custom coordinates (moving with the position of a custom node)
     * !#zh ????????????????????????????????????<br>
     * ?????????????????????????????????????????????????????????<br>
     * ??????????????????????????????????????????????????????<br>
     * ???????????????????????????????????????????????????????????????
     * @property {Space} simulationSpace
     */
    @property({
        type: Space,
        animatable: false
    })
    get simulationSpace () {
        return this._simulationSpace;
    }

    set simulationSpace (val) {
        if (val !== this._simulationSpace) {
            this._simulationSpace = val;
            this._assembler._updateMaterialParams();
            this._assembler._updateTrailMaterial();
        }
    }

    /**
     * !#en Controlling the update speed of the entire particle system.
     * !#zh ??????????????????????????????????????????
     * @property {Number} simulationSpeed
     */
    @property
    simulationSpeed = 1.0;

    /**
     * !#en Delay particle emission time after particle system starts running.
     * !#zh ????????????????????????????????????????????????????????????
     * @property {CurveRange} startDelay
     */
    @property({
        type: CurveRange,
    })
    startDelay = new CurveRange();

    /**
     * !#en Particle life cycle???
     * !#zh ?????????????????????
     * @property {CurveRange} startLifetime
     */
    @property({
        type: CurveRange,
    })
    startLifetime = new CurveRange();

    /**
     * !#en Particle initial color
     * !#zh ??????????????????
     * @property {GradientRange} startColor
     */
    @property({
        type: GradientRange,
    })
    startColor = new GradientRange();

    /**
     * !#en Particle scale space
     * !#zh ????????????
     * @property {Space} scaleSpace
     */
    @property({
        type: Space,
    })
    scaleSpace = Space.Local;

    /**
     * !#en Initial particle size
     * !#zh ??????????????????
     * @property {CurveRange} startSize
     */
    @property({
        type: CurveRange,
    })
    startSize = new CurveRange();

    /**
     * !#en Initial particle speed
     * !#zh ??????????????????
     * @property {CurveRange} startSpeed
     */
    @property({
        type: CurveRange,
        range: [-1, 1],
    })
    startSpeed = new CurveRange();

    /**
     * !#en Particle initial rotation angle
     * !#zh ????????????????????????
     * @property {CurveRange} startRotation
     */
    @property({
        type: CurveRange,
        range: [-1, 1],
        radian: true,
    })
    startRotation = new CurveRange();

    /**
     * !#en Gravity coefficient of particles affected by gravity
     * !#zh ????????????????????????????????????
     * @property {CurveRange} gravityModifier
     */
    @property({
        type: CurveRange,
        range: [-1, 1],
    })
    gravityModifier = new CurveRange();

    // emission module
    /**
     * !#en Particles emitted per second
     * !#zh ????????????????????????
     * @property {CurveRange} rateOverTime
     */
    @property({
        type: CurveRange,
    })
    rateOverTime = new CurveRange();

    /**
     * !#en Number of particles emitted per unit distance moved
     * !#zh ???????????????????????????????????????
     * @property {CurveRange} rateOverDistance
     */
    @property({
        type: CurveRange,
    })
    rateOverDistance = new CurveRange();

    /**
     * !#en The number of Brusts that emit a specified number of particles at a specified time
     * !#zh ??????????????????????????????????????????????????? Brust ?????????
     * @property {[Burst]} bursts
     */
    @property({
        type: [Burst],
        animatable: false
    })
    bursts = new Array();

    @property({
        type: [Material],
        displayName: 'Materials',
        visible: false,
        override: true,
    })
    get materials () {
        // if we don't create an array copy, the editor will modify the original array directly.
        return this._materials;
    }

    set materials (val) {
        this._materials = val;
        this._activateMaterial();
    }

    @property
    // shpae module
    _shapeModule = new ShapeModule();
    /**
     * !#en Particle emitter module
     * !#zh ?????????????????????
     * @property {ShapeModule} shapeModule
     */
    @property({
        type: ShapeModule,
        animatable: false
    })
    get shapeModule () {
        return this._shapeModule;
    }
    set shapeModule (val) {
        this._shapeModule = val;
        this._shapeModule.onInit(this);
    }

    @property
    // color over lifetime module
    _colorOverLifetimeModule = new ColorOverLifetimeModule();
    /**
     * !#en Color control module
     * !#zh ??????????????????
     * @property {ColorOverLifetimeModule} colorOverLifetimeModule
     */
    @property({
        type: ColorOverLifetimeModule,
        animatable: false
    })
    get colorOverLifetimeModule () {
        return this._colorOverLifetimeModule;
    }
    set colorOverLifetimeModule (val) {
        this._colorOverLifetimeModule = val;
    }

    @property
    // size over lifetime module
    _sizeOvertimeModule = new SizeOvertimeModule();
    /**
     * !#en Particle size module
     * !#zh ??????????????????
     * @property {SizeOvertimeModule} sizeOvertimeModule
     */
    @property({
        type: SizeOvertimeModule,
        animatable: false
    })
    get sizeOvertimeModule () {
        return this._sizeOvertimeModule;
    }
    set sizeOvertimeModule (val) {
        this._sizeOvertimeModule = val;
    }

    @property
    _velocityOvertimeModule = new VelocityOvertimeModule();
    /**
     * !#en Particle speed module
     * !#zh ??????????????????
     * @property {VelocityOvertimeModule} velocityOvertimeModule
     */
    @property({
        type: VelocityOvertimeModule,
        animatable: false
    })
    get velocityOvertimeModule () {
        return this._velocityOvertimeModule;
    }

    set velocityOvertimeModule (val) {
        this._velocityOvertimeModule = val;
    }

    @property
    _forceOvertimeModule = new ForceOvertimeModule();
    /**
     * !#en Particle acceleration module
     * !#zh ?????????????????????
     * @property {ForceOvertimeModule} forceOvertimeModule
     */
    @property({
        type: ForceOvertimeModule,
        animatable: false
    })
    get forceOvertimeModule () {
        return this._forceOvertimeModule;
    }
    set forceOvertimeModule (val) {
        this._forceOvertimeModule = val;
    }

    @property
    _limitVelocityOvertimeModule = new LimitVelocityOvertimeModule();
    /**
     * !#en Particle limit speed module (only CPU particles are supported)
     * !#zh ???????????????????????????????????? CPU ?????????
     * @property {LimitVelocityOvertimeModule} limitVelocityOvertimeModule
     */
    @property({
        type: LimitVelocityOvertimeModule,
        animatable: false
    })
    get limitVelocityOvertimeModule () {
        return this._limitVelocityOvertimeModule;
    }
    set limitVelocityOvertimeModule (val) {
        this._limitVelocityOvertimeModule = val;
    }

    @property
    _rotationOvertimeModule = new RotationOvertimeModule();
    /**
     * !#en Particle rotation module
     * !#zh ??????????????????
     * @property {RotationOvertimeModule} rotationOvertimeModule
     */
    @property({
        type: RotationOvertimeModule,
        animatable: false
    })
    get rotationOvertimeModule () {
        return this._rotationOvertimeModule;
    }
    set rotationOvertimeModule (val) {
        this._rotationOvertimeModule = val;
    }

    @property
    _textureAnimationModule = new TextureAnimationModule();
    /**
     * !#en Texture Animation Module
     * !#zh ??????????????????
     * @property {TextureAnimationModule} textureAnimationModule
     */
    @property({
        type: TextureAnimationModule,
        animatable: false
    })
    get textureAnimationModule () {
        return this._textureAnimationModule;
    }
    set textureAnimationModule (val) {
        this._textureAnimationModule = val;
        this._textureAnimationModule.onInit(this);
    }

    @property
    _trailModule = new TrailModule();
    /**
     * !#en Particle Trajectory Module
     * !#zh ??????????????????
     * @property {TrailModule} trailModule
     */
    @property({
        type: TrailModule,
        animatable: false
    })
    get trailModule () {
        return this._trailModule;
    }
    set trailModule (val) {
        this._trailModule = val;
        this._trailModule.onInit(this);
    }

    @property
    _renderMode = RenderMode.Billboard;

    /**
     * !#en Particle generation mode
     * !#zh ????????????????????????
     * @property {RenderMode} renderMode
     */
    @property({
        type: RenderMode,
        animatable: false
    })
    get renderMode () {
        return this._renderMode;
    }

    set renderMode (val) {
        if (this._renderMode === val) {
            return;
        }
        this._renderMode = val;
        this._assembler._setVertexAttrib();
        this._assembler._updateModel();
        this._assembler._updateMaterialParams();
    }

    @property
    _velocityScale = 1;

    /**
     * !#en When the particle generation mode is StrecthedBillboard, in the direction of movement of the particles is stretched by velocity magnitude
     * !#zh ???????????????????????? StrecthedBillboard ???,??????????????????????????????????????????????????????
     * @property {Number} velocityScale
     */
    @property({
        animatable: false
    })
    get velocityScale () {
        return this._velocityScale;
    }

    set velocityScale (val) {
        this._velocityScale = val;
        this._assembler._updateMaterialParams();
    }

    @property
    _lengthScale = 1;
    /**
     * !#en When the particle generation method is StrecthedBillboard, the particles are stretched according to the particle size in the direction of motion
     * !#zh ???????????????????????? StrecthedBillboard ???,??????????????????????????????????????????????????????
     * @property {Number} lengthScale
     */
    @property({
        animatable: false
    })
    get lengthScale () {
        return this._lengthScale;
    }

    set lengthScale (val) {
        this._lengthScale = val;
        this._assembler._updateMaterialParams();
    }

    @property
    _mesh = null;

    /**
     * !#en Particle model
     * !#zh ????????????
     * @property {Mesh} mesh
     */
    @property({
        type: Mesh,
        animatable: false
    })
    get mesh () {
        return this._mesh;
    }

    set mesh (val) {
        this._mesh = val;
        this._assembler._updateModel();
    }

    /**
     * !#en Particle material
     * !#zh ????????????
     * @property {Material} particleMaterial
     */
    @property({
        type: Material,
        animatable: false
    })
    get particleMaterial () {
        return this.getMaterial(0);
    }

    set particleMaterial (val) {
        this.setMaterial(0, val);
        this._onMaterialModified(0, val);
    }
    
    /**
     * !#en Particle trail material
     * !#zh ??????????????????
     * @property {Material} trailMaterial
     */
    @property({
        type: Material,
        animatable: false
    })
    get trailMaterial () {
        return this.getMaterial(1);
    }

    set trailMaterial (val) {
        this.setMaterial(1, val);
        this._onMaterialModified(1, val);
    }

    _isPlaying;
    _isPaused;
    _isStopped;
    _isEmitting;
    _time;  // playback position in seconds.
    _emitRateTimeCounter;
    _emitRateDistanceCounter;
    _oldWPos;
    _curWPos;
    _customData1;
    _customData2;
    _subEmitters; // array of { emitter: ParticleSystem3D, type: 'birth', 'collision' or 'death'}

    constructor () {
        super();

        this.rateOverTime.constant = 10;
        this.startLifetime.constant = 5;
        this.startSize.constant = 1;
        this.startSpeed.constant = 5;

        // internal status
        this._isPlaying = false;
        this._isPaused = false;
        this._isStopped = true;
        this._isEmitting = false;

        this._time = 0.0;  // playback position in seconds.
        this._emitRateTimeCounter = 0.0;
        this._emitRateDistanceCounter = 0.0;
        this._oldWPos = new Vec3(0, 0, 0);
        this._curWPos = new Vec3(0, 0, 0);

        this._customData1 = new Vec2(0, 0);
        this._customData2 = new Vec2(0, 0);

        this._subEmitters = []; // array of { emitter: ParticleSystemComponent, type: 'birth', 'collision' or 'death'}
    }

    onLoad () {
        this._assembler.onInit(this);
        this.shapeModule.onInit(this);
        this.trailModule.onInit(this);
        this.textureAnimationModule.onInit(this);

        this._resetPosition();

        // this._system.add(this);
    }

    _onMaterialModified (index, material) {
        this._assembler._onMaterialModified(index, material);
    }

    _onRebuildPSO (index, material) {
        this._assembler._onRebuildPSO(index, material);
    }

    // TODO: fastforward current particle system by simulating particles over given period of time, then pause it.
    // simulate(time, withChildren, restart, fixedTimeStep) {

    // }

    /**
     * !#en Playing particle effects
     * !#zh ??????????????????
     * @method play
     */
    play () {
        if (this._isPaused) {
            this._isPaused = false;
        }
        if (this._isStopped) {
            this._isStopped = false;
        }

        this._isPlaying = true;
        this._isEmitting = true;

        this._resetPosition();

        // prewarm
        if (this._prewarm) {
            this._prewarmSystem();
        }
    }

    /**
     * !#en Pause particle effect
     * !#zh ????????????????????????
     * @method pause
     */
    pause () {
        if (this._isStopped) {
            console.warn('pause(): particle system is already stopped.');
            return;
        }
        if (this._isPlaying) {
            this._isPlaying = false;
        }

        this._isPaused = true;
    }

    /**
     * !#en Stop particle effect
     * !#zh ????????????????????????
     * @method stop
     */
    stop () {
        if (this._isPlaying || this._isPaused) {
            this.clear();
        }
        if (this._isPlaying) {
            this._isPlaying = false;
        }
        if (this._isPaused) {
            this._isPaused = false;
        }

        this._time = 0.0;
        this._emitRateTimeCounter = 0.0;
        this._emitRateDistanceCounter = 0.0;

        this._isStopped = true;
    }

    // remove all particles from current particle system.
    /**
     * !#en Remove all particle effect
     * !#zh ???????????????????????????????????????
     * @method clear
     */
    clear () {
        if (this.enabledInHierarchy) {
            this._assembler.clear();
            this.trailModule.clear();
        }
    }

    getParticleCount () {
        return this._assembler.getParticleCount();
    }

    setCustomData1 (x, y) {
        Vec2.set(this._customData1, x, y);
    }

    setCustomData2 (x, y) {
        Vec2.set(this._customData2, x, y);
    }

    onDestroy () {
        // this._system.remove(this);
        this._assembler.onDestroy();
        this.trailModule.destroy();
    }

    onEnable () {
        super.onEnable();
        if (this.playOnAwake) {
            this.play();
        }
        this._assembler.onEnable();
        this.trailModule.onEnable();
    }

    onDisable () {
        super.onDisable();
        this._assembler.onDisable();
        this.trailModule.onDisable();
    }

    update (dt) {
        const scaledDeltaTime = dt * this.simulationSpeed;
        if (this._isPlaying) {
            this._time += scaledDeltaTime;

            // excute emission
            this._emit(scaledDeltaTime);

            // simulation, update particles.
            if (this._assembler._updateParticles(scaledDeltaTime) === 0 && !this._isEmitting) {
                this.stop();
            }

            // update render data
            this._assembler.updateParticleBuffer();

            // update trail
            if (this.trailModule.enable) {
                this.trailModule.updateTrailBuffer();
            }
        }
    }

    emit (count, dt) {

        if (this._simulationSpace === Space.World) {
            this.node.getWorldMatrix(_world_mat);
        }

        for (let i = 0; i < count; ++i) {
            const particle = this._assembler._getFreeParticle();
            if (particle === null) {
                return;
            }
            const rand = pseudoRandom(randomRangeInt(0, INT_MAX));

            if (this.shapeModule.enable) {
                this.shapeModule.emit(particle);
            }
            else {
                Vec3.set(particle.position, 0, 0, 0);
                Vec3.copy(particle.velocity, particleEmitZAxis);
            }

            if (this.textureAnimationModule.enable) {
                this.textureAnimationModule.init(particle);
            }

            Vec3.scale(particle.velocity, particle.velocity, this.startSpeed.evaluate(this._time / this.duration, rand));

            switch (this._simulationSpace) {
                case Space.Local:
                    break;
                case Space.World:
                    Vec3.transformMat4(particle.position, particle.position, _world_mat);
                    const worldRot = new Quat();
                    this.node.getWorldRotation(worldRot);
                    Vec3.transformQuat(particle.velocity, particle.velocity, worldRot);
                    break;
                case Space.Custom:
                    // TODO:
                    break;
            }
            Vec3.copy(particle.ultimateVelocity, particle.velocity);
            // apply startRotation. now 2D only.
            Vec3.set(particle.rotation, 0, 0, this.startRotation.evaluate(this._time / this.duration, rand));

            // apply startSize. now 2D only.
            Vec3.set(particle.startSize, this.startSize.evaluate(this._time / this.duration, rand), 1, 1);
            particle.startSize.y = particle.startSize.x;
            Vec3.copy(particle.size, particle.startSize);

            // apply startColor.
            particle.startColor.set(this.startColor.evaluate(this._time / this.duration, rand));
            particle.color.set(particle.startColor);

            // apply startLifetime.
            particle.startLifetime = this.startLifetime.evaluate(this._time / this.duration, rand) + dt;
            particle.remainingLifetime = particle.startLifetime;

            particle.randomSeed = randomRangeInt(0, 233280);

            this._assembler._setNewParticle(particle);

        } // end of particles forLoop.
    }

    // initialize particle system as though it had already completed a full cycle.
    _prewarmSystem () {
        this.startDelay.mode = Mode.Constant; // clear startDelay.
        this.startDelay.constant = 0;
        const dt = 1.0; // should use varying value?
        const cnt = this.duration / dt;
        for (let i = 0; i < cnt; ++i) {
            this._time += dt;
            this._emit(dt);
            this._assembler._updateParticles(dt);
        }
    }

    // internal function
    _emit (dt) {
        // emit particles.
        const startDelay = this.startDelay.evaluate(0, 1);
        if (this._time > startDelay) {
            if (this._time > (this.duration + startDelay)) {
                // this._time = startDelay; // delay will not be applied from the second loop.(Unity)
                // this._emitRateTimeCounter = 0.0;
                // this._emitRateDistanceCounter = 0.0;
                if (!this.loop) {
                    this._isEmitting = false;
                    return;
                }
            }

            // emit by rateOverTime
            this._emitRateTimeCounter += this.rateOverTime.evaluate(this._time / this.duration, 1) * dt;
            if (this._emitRateTimeCounter > 1 && this._isEmitting) {
                const emitNum = Math.floor(this._emitRateTimeCounter);
                this._emitRateTimeCounter -= emitNum;
                this.emit(emitNum, dt);
            }
            // emit by rateOverDistance
            this.node.getWorldPosition(this._curWPos);
            const distance = Vec3.distance(this._curWPos, this._oldWPos);
            Vec3.copy(this._oldWPos, this._curWPos);
            this._emitRateDistanceCounter += distance * this.rateOverDistance.evaluate(this._time / this.duration, 1);
            if (this._emitRateDistanceCounter > 1 && this._isEmitting) {
                const emitNum = Math.floor(this._emitRateDistanceCounter);
                this._emitRateDistanceCounter -= emitNum;
                this.emit(emitNum, dt);
            }

            // bursts
            for (const burst of this.bursts) {
                burst.update(this, dt);
            }
        }
    }

    _activateMaterial () {
        
    }

    _resetPosition () {
        this.node.getWorldPosition(this._oldWPos);
        Vec3.copy(this._curWPos, this._oldWPos);
    }

    addSubEmitter (subEmitter) {
        this._subEmitters.push(subEmitter);
    }

    removeSubEmitter (idx) {
        this._subEmitters.splice(this._subEmitters.indexOf(idx), 1);
    }

    addBurst (burst) {
        this.bursts.push(burst);
    }

    removeBurst (idx) {
        this.bursts.splice(this.bursts.indexOf(idx), 1);
    }

    _checkBacth () {
        
    }

    get isPlaying () {
        return this._isPlaying;
    }

    get isPaused () {
        return this._isPaused;
    }

    get isStopped () {
        return this._isStopped;
    }

    get isEmitting () {
        return this._isEmitting;
    }

    get time () {
        return this._time;
    }
}

CC_EDITOR && (ParticleSystem3D.prototype._onBeforeSerialize = function(props){return props.filter(p => !_module_props.includes(p) || this[p].enable);});

cc.ParticleSystem3D = ParticleSystem3D;
