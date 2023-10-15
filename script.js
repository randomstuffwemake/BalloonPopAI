import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const app = new PIXI.Application({ width: 1280, height: 720 });
const balloonTexture = PIXI.Texture.from("balloon.png");
const poppedBalloonTexture = PIXI.Texture.from("popped.png");
const popSound = new Audio("pop.mp3");
const scoreText = new PIXI.Text('Score: 0', {
    fontFamily: 'Barlow',
    fontSize: 40,
    fill: 0x000000,
    align: 'center',
});
const markerGraphics = new PIXI.Graphics();

let video = document.getElementById('webcam');

document.body.appendChild(app.view);

let handLandmarker;
let lastVideoTime = -1;
let balloons = [];
let pinchedFlag = false;
let score = 0;

async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO"
    });
}

setup();    

function setup() {
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }).then(function (stream) {
        video.srcObject = stream;
        video.play();
        video.onplay = function () {
            const videoTexture = PIXI.Texture.from(video);
            const videoSprite = new PIXI.Sprite(videoTexture);
            videoSprite.width = app.screen.width;
            videoSprite.height = app.screen.height;
            videoSprite.anchor.x = 1;
            videoSprite.scale.x *= -1;
            app.stage.addChildAt(videoSprite, 0);
        };
        video.addEventListener("loadeddata", async () => {
            await createHandLandmarker();
            createBalloons();
            app.stage.addChild(scoreText);
            app.stage.addChild(markerGraphics);
            app.ticker.add(delta => gameLoop(delta));
        });
    }).catch(function (err) {
        console.error("Error accessing webcam:", err);
    });
}

function calculateDistance(point1, point2) {
    return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
}

function processDetections(detections) {
    if (detections.handednesses.length) {
        const indexTip = detections.landmarks[0][8];
        const thumbTip = detections.landmarks[0][4];
        markerGraphics.clear();
        markerGraphics.beginFill(0x4ce73c);
        markerGraphics.drawCircle(1280 - indexTip.x * 1280, indexTip.y * 720, 10);
        markerGraphics.drawCircle(1280 - thumbTip.x * 1280, thumbTip.y * 720, 10);
        markerGraphics.endFill();
        if (!pinchedFlag && calculateDistance(indexTip, thumbTip) < 0.04) {
            pinchedFlag = true;
            const pinchedPoint = {x: (1280 - (((indexTip.x + thumbTip.x) / 2) * 1280)), y: (((indexTip.y + thumbTip.y) / 2) * 720)}
            for (let balloon of balloons) {
                if (balloon.containsPoint(pinchedPoint)) {
                    balloon.emit('balloonpop', balloon);
                }
            }
        } else if (pinchedFlag && calculateDistance(indexTip, thumbTip) >= 0.04) {
            pinchedFlag = false;
        }
    } else {
        markerGraphics.clear();
    }
}

function gameLoop(delta) {
    for (let balloon of balloons) {
        balloon.y += 1.5;
        if (balloon.y > app.screen.height) {
            balloon.x = Math.random() * app.screen.width;
            balloon.y = -100;
        }
    }
    let startTimeMs = performance.now();
    if (video.currentTime !== lastVideoTime) {
        const detections = handLandmarker.detectForVideo(video, startTimeMs);
        processDetections(detections);
        lastVideoTime = video.currentTime;
    }
}

function createBalloons() {
    for (let i = 0; i < 5; i++) {
        const balloon = new PIXI.Sprite(balloonTexture);
        balloon.scale.set(0.5);
        balloon.eventMode = 'static';
        balloon.buttonMode = true;
        balloon.anchor.set(0.5);
        balloon.x = Math.random() * app.screen.width;
        balloon.y = Math.random() * -app.screen.height;
        balloon.on('balloonpop', popBalloon);
        balloons.push(balloon);
        app.stage.addChild(balloon);
    }
}

function popBalloon(balloon) {
    balloon.texture = poppedBalloonTexture;
    setTimeout(() => {
        balloon.texture = balloonTexture;
        balloon.x = Math.random() * app.screen.width;
        balloon.y = -100;
    }, 1000)
    const sound = popSound.cloneNode();
    sound.play();
    score += 1;
    scoreText.text = `Score: ${score}`;
}