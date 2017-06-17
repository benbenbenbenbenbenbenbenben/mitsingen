function getOffset( el ) {
	var _x = 0;
	var _y = 0;
	while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
		_x += el.offsetLeft;
		_y += el.offsetTop;
		el = el.offsetParent;
	}
	return { top: _y, left: _x };
}

function getBeatOffset(beat)
{
	row = document.getElementById(beat);
	return getOffset(row).top;
}

function resetStyles()
{
	rows = document.getElementsByClassName("row")
	for (var i = 0; i < rows.length; i++)
	{
		rows[i].style["background-color"] = "#ffffff";
	}

	for (var num_syllables = 1; num_syllables < 4; num_syllables += 1)
	{
		for (var syllable = 0; syllable < num_syllables; syllable += 1)
		{ 
			elements = document.getElementsByClassName("" + num_syllables + "." + syllable);

			for (var i = 0; i < elements.length; i++)
			{
				elements[i].style.color = "#cccccc";
			}
		}
	}
}

function setBeatTime(newBeatTime)
{
	beatTime = newBeatTime;
	easeTime = newBeatTime * 0.3;
	staticTime = beatTime - easeTime;
}

var webAudioContext = undefined;

function getTime()
{
	if (webAudioContext != undefined)
	{
		return webAudioContext.currentTime * 1000;
	}
	else
	{
		date = new Date();
		return date.getTime();
	}
}

var startTime;
var startBeat = 0;

var beatTime;
var easeTime;
var staticTime;
setBeatTime(545);

var lastProgress = undefined;
var lastBeat = undefined;
var beatTop, nextBeatTop;
var beat = undefined;

var timeDifference = 0;

function frame()
{
	time = getTime() - startTime + startBeat * beatTime;

	if (time < 0) return;

	beat = Math.floor(time / beatTime);
	progress = time - beat * beatTime;

	if (beat != lastBeat)
	{
		window.navigator.vibrate([20]);

		beatRow = document.getElementById(beat);
		nextBeatRow = document.getElementById(beat+1);

		if (nextBeatRow == null)
		{
			stop();
			return;
		}

		//beatRow.style["background-color"] = "#dddddd";

		beatTop = getOffset(beatRow).top;
		nextBeatTop = getOffset(nextBeatRow).top;
	}

	for (var num_syllables = 1; num_syllables < 4; num_syllables += 1)
	{
		for (var syllable = 0; syllable < num_syllables; syllable += 1)
		{ 
			syllableTime = syllable * beatTime / num_syllables;

			if (progress >= syllableTime && (lastProgress < syllableTime || lastProgress > progress || lastProgress == undefined))
			{
				elements = beatRow.getElementsByClassName("" + num_syllables + "." + syllable);
				for (var i = 0; i < elements.length; i++)
				{
					elements[i].style.color = "#000000";
				}
			}
		}
	}

	var top;
	if (progress < staticTime)
	{
		top = beatTop;
	}
	else
	{
		anim = Math.pow((progress - staticTime)/easeTime, 3);
		top = beatTop + (nextBeatTop - beatTop) * anim;
	}

	window.scrollTo(0, top);

	lastProgress = progress;
	lastBeat = beat;
}

var intervalId = undefined;

function start(time)
{
	startTime = time + timeDifference;

	if (intervalId == undefined)
	{
		intervalId = setInterval(frame, 25);
	}
}

function startFromBeat(time, beatToStartFrom)
{
	resetStyles();
	startBeat = beatToStartFrom;
	startTime = time + timeDifference;

	if (intervalId == undefined)
	{
		intervalId = setInterval(frame, 25);
	}
}

function isPlaying()
{
	return intervalId != undefined;
}

function stop()
{
	if (intervalId != undefined)
	{
		clearInterval(intervalId);
		intervalId = undefined;
	}
}

var webSocket;

function ping()
{
	date = new Date();
	webSocket.send("ping " + getTime());
}

function followWebAudioContext(webAudioContextToFollow)
{
	webAudioContext = webAudioContextToFollow;

	syncIndicator = document.getElementById("sync-indicator");
	syncIndicator.style["background-color"] = "white";
}

function setStartBeat(newStartBeat)
{
	stop();
	resetStyles();
	startBeat = newStartBeat;
	window.scrollTo(0, getBeatOffset(startBeat));
}

// Interface for mitsingen
window.followWebAudioContext = followWebAudioContext;
window.startFromBeat = startFromBeat;
window.stop = stop;
window.setBeatTime = setBeatTime;
window.setStartBeat = setStartBeat;

function followConductor()
{
	setTimeout(function()
	{
		webSocket = new WebSocket("ws://192.168.1.5:8000/");

		webSocket.onmessage = function (event)
		{
			console.log("Got message", event.data)
			if (event.data.startsWith("start"))
			{
				if (!isPlaying())
				{
					resetStyles();
					data = JSON.parse(event.data.slice(6));
					startBeat = data[0];
					setBeatTime(data[1]);
					time = data[2];
					window.scrollTo(0, getBeatOffset(startBeat));
					start(time);
				}
			}
			else if (event.data == "ping_invitation")
			{
				ping();
			}
			else if (event.data == "stop")
			{
				stop();
			}
			else if (event.data.startsWith("setBeat "))
			{
				setStartBeat(parseInt(event.data.slice(8)));
			}
			else if (event.data.startsWith("setBeatTime "))
			{
				stop();

				if (beat != undefined)
				{
					startBeat = beat;
				}

				setBeatTime(parseInt(event.data.slice(12)));

				console.log("startBeat: ", startBeat, "  beatTime: ", beatTime)
			}
			else if (event.data.startsWith("pong"))
			{
				console.log("Got pong");
				data = JSON.parse(event.data.slice(5));

				pingTime = parseInt(data[0]);
				pongTime = data[1];
				date = new Date();
				localTime = getTime();
				localTimeAtPong = (pingTime + localTime) / 2; // estimate

				console.log(" ... ping->now " + (localTime - pingTime) + "   pong "+pongTime);
				console.log(" ... time difference " + (localTimeAtPong - pongTime));

				timeDifference = localTimeAtPong - pongTime;
				console.log(" ... time difference " + timeDifference);

				syncIndicator = document.getElementById("sync-indicator");
				syncIndicator.style["background-color"] = "white";

				//setTimeout(ping, Math.random() * 5000 + 5000);
			}
		}

		webSocket.onopen = function (event)
		{
			console.log("Sending handshake")
			webSocket.send("i_am_singer");
		}
	}, Math.random() * 1000 + 1000);
}
