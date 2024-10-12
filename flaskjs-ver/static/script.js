const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const FPS = 40;
const PLAYERMOVERATE = 5;
let topScore = 0;
let highScores = [];
let currentScore = 0;
    let hitMessage = "";
    let messageDisplayTime = 0;
    const MESSAGE_DURATION = 300; //0.3s

    const ipproto = new Map([[1, "icmp"], [6,"tcp"], [17, "udp"]]);


const socket = io.connect('https://' + document.domain + ':' + location.port);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let playerImage = new Image();
playerImage.src = 'static/images/player.png';
let baddieImage = new Image();
baddieImage.src = 'static/images/baddie.png';
let bubbleImage = new Image();
bubbleImage.src = 'static/images/bubble.png';

playerImage.onerror = () => console.error('Failed to load player.png');
baddieImage.onerror = () => console.error('Failed to load baddie.png');
bubbleImage.onerror = () => console.error('Failed to load bubble.png');

let player = {
    width: 40,
    height: 40,
    x: canvas.width / 2 - 20,
    y: canvas.height - 70,
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false
};
let baddies = [];
let score = 0;
    let bubbles = [];
    const BUBBLESPEED = 10;

    function shootBubble() {
        const bubble = {
            x: player.x + player.width / 2 - 5,
            y: player.y,
            width: 10,
            height: 20,
            speed: BUBBLESPEED
        };
        bubbles.push(bubble);
    }
    function moveBubbles() {
        for (let i = 0; i < bubbles.length; i++) {
            bubbles[i].y -= bubbles[i].speed;
        }
        bubbles = bubbles.filter(b => b.y + b.height > 0); // Remove off-screen bubbles
    }

    function detectBubbleCollision() {
        for (let i = bubbles.length - 1; i >= 0; i--) {
            for (let j = baddies.length - 1; j >= 0; j--) {
                if (bubbles[i].x < baddies[j].x + baddies[j].width &&
                    bubbles[i].x + bubbles[i].width > baddies[j].x &&
                    bubbles[i].y < baddies[j].y + baddies[j].height &&
                    bubbles[i].y + bubbles[i].height > baddies[j].y) {
    		console.log(baddies[j].type)
    		hitMessage = "You bastered " + ipproto.get(baddies[j].type) + "!";
    		messageDisplayTime = Date.now();
                    // Remove both the bullet and the baddie
                    bubbles.splice(i, 1);
                    baddies.splice(j, 1);
                    score += 10; // Increment score for hitting a baddie
                    break;
                }
            }
        }
    }


function addBaddie(type, packet_len) {
    //const size = Math.floor(Math.random() * 40) + 10;
    let size;
    if (type == 6) { //tcp
    	size = 30;
    } else if (type == 17) { //udp
    	size = 40;
    } else if (type == 1) { //icmp
    	size = 20;
    } else {
    	size = 10
    }
    console.log(size)
    const speed = Math.floor(Math.random() * 8) + 1; //packetbytes de kimeru?
    const x = Math.floor(Math.random() * (canvas.width - size));
    baddies.push({ width: size, height: size, x, y: -size, speed, type, packet_len});
}

function movePlayer() {
    if (player.moveLeft && player.x > 0) player.x -= PLAYERMOVERATE;
    if (player.moveRight && player.x + player.width < canvas.width) player.x += PLAYERMOVERATE;
    if (player.moveUp && player.y > 0) player.y -= PLAYERMOVERATE;
    if (player.moveDown && player.y + player.height < canvas.height) player.y += PLAYERMOVERATE;
}

function moveBaddies() {
    for (let i = 0; i < baddies.length; i++) {
        baddies[i].y += baddies[i].speed;
    }
    offscreenbaddies = baddies.filter(b => b.y > canvas.height);
    for (let i = 0; i < offscreenbaddies.length; i++) {
    	console.log(offscreenbaddies[i].packet_len);
    	score += offscreenbaddies[i].packet_len;
    }
    baddies = baddies.filter(b => b.y < canvas.height);
}

function detectCollision() {
    for (let i = 0; i < baddies.length; i++) {
        if (player.x < baddies[i].x + baddies[i].width &&
            player.x + player.width > baddies[i].x &&
            player.y < baddies[i].y + baddies[i].height &&
            player.y + player.height > baddies[i].y) {
            return true;
        }
    }
    return false;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);

    for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        ctx.drawImage(bubbleImage, b.x, b.y, b.width, b.height);
    }

    for (let i = 0; i < baddies.length; i++) {
        const b = baddies[i];
        ctx.drawImage(baddieImage, b.x, b.y, b.width, b.height);
    }

    ctx.fillStyle = "white";
    ctx.font = "24px Arial";
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Top Score: ${topScore}`, 10, 60);

    // Display hit message if within duration
        if (hitMessage && Date.now() - messageDisplayTime < MESSAGE_DURATION) {
            ctx.font = "32px Arial";
            ctx.fillStyle = "yellow";
            ctx.fillText(hitMessage, canvas.width / 2 - 40, canvas.height / 2);
        } else {
            hitMessage = ""; // Clear the message after the duration
        }
}

function gameLoop() {
    movePlayer();
    moveBubbles();
    moveBaddies();
    detectBubbleCollision();

    if (detectCollision()) {
        if (score > topScore) topScore = score;
        highScores.push(score);
        highScores.sort((a, b) => b - a);
        currentScore = score;
        let rank = highScores.indexOf(currentScore) + 1;
        gameOver(rank);
        return;
    }

    //score++;
    draw();
    setTimeout(() => requestAnimationFrame(gameLoop), 1000 / FPS);
}

function gameOver(rank) {
    drawText("GAME OVER", canvas.width / 3, canvas.height / 3, 48, "red");
    drawText(`Your score: ${currentScore} bytes!`, canvas.width / 3 - 40, canvas.height / 3 + 50, 24, "white");
    drawText(`Rank: ${rank} / ${highScores.length}`, canvas.width / 3 - 40, canvas.height / 3 + 100, 24, "yellow");

    drawText("Top Scores:", canvas.width / 3 - 40, canvas.height / 3 + 150, 24, "white");
    for (let i = 0; i < Math.min(5, highScores.length); i++) {
        let color = (i + 1 === rank) ? "yellow" : "white";
        drawText(`${i + 1}. ${highScores[i]}`, canvas.width / 3 - 40, canvas.height / 3 + 180 + (i * 30), 20, color);
    }

    drawText("Press any key (except arrows) to restart", canvas.width / 3 - 60, canvas.height / 3 + 350, 24, "red");

    window.addEventListener('keydown', handleRestart, { once: true });
}

function handleRestart(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        window.addEventListener('keydown', handleRestart, { once: true });
    } else {
        restartGame();
    }
}

function restartGame() {
    score = 0;
    baddies = [];
    player.x = canvas.width / 2 - 20;
    player.y = canvas.height - 70;
    gameLoop();
}

socket.on('packet', (msg) => {
    console.log('Packet received. Adding a new baddie.');
    //console.log(msg)
    const packet_type = msg.data.type
    const packet_len = msg.data.type
    console.log(packet_type)
    addBaddie(packet_type, packet_len);
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') player.moveLeft = true;
    if (e.key === 'ArrowRight') player.moveRight = true;
    if (e.key === 'ArrowUp') player.moveUp = true;
    if (e.key === 'ArrowDown') player.moveDown = true;
    if (e.key === ' ') shootBubble();
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') player.moveLeft = false;
    if (e.key === 'ArrowRight') player.moveRight = false;
    if (e.key === 'ArrowUp') player.moveUp = false;
    if (e.key === 'ArrowDown') player.moveDown = false;
});

drawText("eBPF Dodger\nPress any key to start", canvas.width / 3, canvas.height / 2, 32);
window.addEventListener('keydown', () => {
    gameLoop();
}, { once: true });

function drawText(text, x, y, size = 24, color = "white") {
    ctx.fillStyle = color;
    ctx.font = `${size}px Arial`;
    ctx.fillText(text, x, y);
}

