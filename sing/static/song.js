var audioContext = new AudioContext();

var inputAudio = undefined;
if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                      navigator.mozGetUserMedia || navigator.msGetUserMedia;

navigator.getUserMedia({audio:true},
    function(e)
    {
        inputAudio = e;
    },
    function(e)
    {
        alert("Couldn't get audio input - you won't be able to record yourself.");
    }
);

function loadAudio(url, callback)
{
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    request.onload = function() {
        audioContext.decodeAudioData(request.response, function(buffer)
        {
            callback(buffer);
        });
    }
    request.send();
}

window.requestAnimFrame = (function(callback)
{
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
    function(callback) {
      window.setTimeout(callback, 1000 / 10);
    };
})();

var canvas = document.getElementById('song');
var context = canvas.getContext('2d', {alpha: false});
var allBuffer = undefined;
var partBuffer = undefined;
var otherPartRecordingBuffers = undefined;
var recordingBuffer = undefined;
var tempo = undefined;
var isFreeform = undefined;
var secondsPerBeat = undefined;
var lengthInBeats = undefined;
var lengthInSeconds = undefined;
var startBeat = 0;
var endBeat = undefined;
var holdingStart = false;
var holdingEnd = false;
var playing = false;
var playStartTime = undefined;
var recordingStartTime = undefined;
var latencySeconds = 0;
var sections = [];
var timeSignatures = [];
var numberBuffers = [];
var lastRecordStopTimeout = undefined;
var timelineHeight = 25;
var mouseOverCanvas = false;
var isStaff = false;

var toggleOptions = {
    "record": {
        "hearMetronome": false,
        "hearPart": true,
        "hearAll": false
    },
    "review": {
        "hearPart": true,
        "hearAll": false
    }
}


function setIsStaff(is)
{
    isStaff = is;
}

outputGain = audioContext.createGain();
outputGain.connect(audioContext.destination);


var xMargin = 6;
var xMargins = xMargin * 2;

function xToBeats(x)
{
    if (!partBuffer.ready()) return 0;

    return lengthInBeats * (x - xMargin) / (canvas.width - xMargins);
}

function beatsToX(beats)
{
    if (!partBuffer.ready()) return 0;

    return xMargin + (canvas.width - xMargins) * beats / lengthInBeats;
}

function timeToX(time)
{
    if (!partBuffer.ready()) return 0;

    return xMargin + (canvas.width - xMargins) * time / lengthInSeconds;
}

function isNearStart(x)
{
    return Math.abs(x - beatsToX(startBeat)) < 10
}

function isNearEnd(x)
{
    return Math.abs(x - beatsToX(endBeat)) < 10
}

function updateLyrics()
{
    lyrics = [];
    sections.forEach(function (section)
    {
        if (section.containsRange(startBeat, endBeat))
        {
            lyrics.push("<p class='section'>"+section.lyrics.replace(/\n/g, "<br>")+"</p>");
        }
    });

    lyrics = lyrics.join("");

    element = document.getElementById("lyrics-content");
    if (element)
    {
        element.innerHTML = lyrics;
    }
}

function setStartBeat(newStartBeat)
{
    if (newStartBeat < 0) newStartBeat = 0;
    if (newStartBeat > lengthInBeats - 1) newStartBeat = lengthInBeats - 1;
    startBeat = newStartBeat;
    element = document.getElementById("id_start");
    if (element)
    {
        element.value = startBeat;
    }

    element = document.getElementById("id_startBeatInSong");
    if (element)
    {
        element.value = startBeat;
    }

    updateLyrics();

    if (startTimeCallback != undefined)
    {
        startTimeCallback(startBeat+5);
    }
}

function setEndBeat(newEndBeat)
{
    if (newEndBeat < 1) newEndBeat = 1;
    if (newEndBeat > lengthInBeats) newEndBeat = lengthInBeats;

    endBeat = newEndBeat;
    element = document.getElementById("id_end");
    if (element)
    {
        element.value = endBeat;
    }

    updateLyrics();
}

function begin()
{
    canvas.addEventListener('mousedown', function(event)
    {
        event.preventDefault();

        x = event.pageX - canvas.offsetLeft;
        y = event.pageY - canvas.offsetTop;

        sectionClicked = false;


        if (isNearStart(x))
        {
            holdingStart = true;
        }
        else if (isNearEnd(x))
        {
            holdingEnd = true;
        }
        else
        {
            sections.forEach(function (section, index)
            {
                if (section.visContains(x, y))
                {
                    // Select the section
                    if (event.shiftKey)
                    {
                        if (section.start < startBeat) setStartBeat(section.start);
                        if (section.end > endBeat) setEndBeat(section.end);
                    }
                    else
                    {
                        setStartBeat(section.start);
                        setEndBeat(section.end);
                    }

                    viewDirty = true;
                    sectionClicked = true;
                }
            });
        }
    });

    canvas.addEventListener('mousemove', function(event)
    {
        event.preventDefault();
        x = event.pageX - canvas.offsetLeft;
        y = event.pageY - canvas.offsetTop;

        newMouseOverCanvas = x > 0 && x < canvas.width && y > 0 && y < canvas.height;
        viewDirty = viewDirty || mouseOverCanvas != newMouseOverCanvas;
        mouseOverCanvas = newMouseOverCanvas

        if (holdingStart)
        {
            setStartBeat(Math.min(endBeat - 1, Math.round(xToBeats(x))));
            viewDirty = true;
        }
        else if(holdingEnd)
        {
            setEndBeat(Math.max(startBeat+1, Math.round(xToBeats(x))));
            viewDirty = true;
        }
        else
        {
            sectionHovered = false;
            if (isNearStart(x) || isNearEnd(x))
            {
                document.body.style.cursor = "e-resize";
            }
            else
            {
                sections.forEach(function (section, index)
                {
                    if (section.visContains(x, y))
                    {
                        document.body.style.cursor = "pointer";
                        sectionHovered = true;
                    }
                });

                if (!sectionHovered)
                {
                    document.body.style.cursor = "default";
                }
            }
        }
    });

    canvas.addEventListener('mouseup', function(event)
    {
        event.preventDefault();
        holdingStart = false;
        holdingEnd = false;
    });

    canvas.addEventListener('mouseleave', function(event)
    {
        event.preventDefault();
        holdingStart = false;
        holdingEnd = false;
        document.body.style.cursor = "default";
        mouseOverCanvas = false;
        viewDirty = true;
    });

    window.onresize = function(event) {
        viewDirty = true;
    }

    animate();
}

function overviewBuffer(buffer, overview, startSample, endSample, smoothing)
{
    if (startSample == undefined) startSample = 0;
    if (endSample == undefined) endSample = buffer.length;

    if (smoothing == undefined) smoothing = 1;

    data = buffer.getChannelData(0);
    windowSize = Math.floor(buffer.length / overview.length);
    startWindow = Math.floor(startSample / windowSize);
    endWindow = Math.ceil(endSample / windowSize);
    numWindows = endWindow - startWindow;
    maxSample = 0;

    for(var i = startWindow; i < endWindow; i++)
    {
        var acc = 0;
        var num = 0;
        for(var j = 0; j < windowSize; j+=1)
        {
            acc = Math.max(acc, Math.abs(data[Math.floor((i/overview.length) * buffer.length) + j]));
            num += 1;
        }
        overview[i] = acc;
    }

    for(var i = endWindow - 1; i >= startWindow; i--)
    {
        var acc = 0;
        var num = 0;
        for(var j = 0; j < smoothing; j+=1)
        {
            if (i - j >= 0)
            {
                acc += overview[i - j];
                num += 1;
            }
        }
        overview[i] = acc / num;
        if (overview[i] > maxSample) maxSample = overview[i];
    }

    return maxSample;
}

function timeSignatureAtBeat(beat)
{
    for (var i = 0; i < timeSignatures.length; i++)
    {
        timeSignature = timeSignatures[i];
        if (beat >= timeSignature.startBeatInSong) return timeSignature;
    }

    // Default to 4/4 starting at first beat
    return new TimeSignature(0, 0, 4);
}

function TimeSignature(startBeatInSong, startBeatInBar, beatsPerBar)
{
    this.startBeatInSong = startBeatInSong;
    this.startBeatInBar = startBeatInBar;
    this.beatsPerBar = beatsPerBar;

    this.beatInBarAtBeat = function(beat)
    {
        return (beat - this.startBeatInSong + startBeatInBar) % this.beatsPerBar;
    }
}

function Section(name, start, end, lyrics)
{
    this.name = name;
    this.start = start;
    this.end = end;
    this.lyrics = lyrics;

    this.containsBeat = function(beat)
    {
        return beat >= this.start && beat <= this.end;
    }

    this.containsRange = function(start, end)
    {
        return end > this.start && start < this.end;
    }

    this.visContains = function(x, y)
    {
        return x > beatsToX(this.start) && x < beatsToX(this.end);
    }
}

function RecordingBuffer(lengthSamples)
{
    this.buffer = audioContext.createBuffer(1,
        lengthSamples,
        audioContext.sampleRate);

    this.overview = new Float32Array(1000);
}

function MidiNote(pitch, start)
{
    this.pitch = pitch;
    this.start = start;
    this.end = undefined;
}

function AudioBuffer(url, midiUrl, onLoaded, smoothing)
{
    this.url = url;
    this.midiUrl = midiUrl;
    this.buffer = undefined;
    this.midiFile = undefined;
    this.midiNotes = undefined;
    this.highNote = undefined;
    this.lowNote = undefined;
    this.overview = new Float32Array(1000);
    //this.spectrumCentre = new Float32Array(1000);
    this.onLoaded = onLoaded;
    this.maxSample = 0;
    this.smoothing = smoothing == undefined ? 1 : smoothing;

    console.log(this.midiUrl);
    if (this.midiUrl)
    {
        var request = new XMLHttpRequest();
        request.open('GET', this.midiUrl, true);
        request.responseType = 'arraybuffer';

        request.onload = function() {
            this.midiFile = new MIDIFile(request.response);
            this.midiNotes = [];

            this.midiFile.getMidiEvents().forEach(function (event)
            {
                note = event.param1;
                velocity = event.param2;

                if (event.subtype == 9)
                {
                    this.midiNotes.push(new MidiNote(note, event.playTime));

                    if (this.highNote === undefined || this.highNote < note) this.highNote = note;
                    if (this.lowNote === undefined || this.lowNote > note) this.lowNote = note;
                }
                else if (event.subtype == 8)
                {
                    for(var i = this.midiNotes.length-1; i >= 0; i--)
                    {
                        if (this.midiNotes[i].pitch == note && this.midiNotes[i].end == undefined)
                        {
                            this.midiNotes[i].end = event.playTime;
                            break;
                        }
                    }
                }
            }.bind(this));
        }.bind(this);

        request.send();
    }

    loadAudio(url, function (buffer)
    {
        console.log("Loaded "+this.url);
        this.buffer = buffer;
        this.maxSample = overviewBuffer(buffer, this.overview, undefined, undefined, this.smoothing);

        /*
        windowSize = 2048;
        var fft = new FFT(windowSize, 44100);
        //var signal = DSP.getChannel(DSP.MIX, buffer);
        var signal = buffer.getChannelData(0);

        for (var i = 0; i < 1000; i++)
        {
            start = (signal.length - windowSize) * i/1000;

            fft.forward(signal.slice(start, start + windowSize));
            var spectrum = fft.spectrum;

            var sum = 0;
            var totalEnergy = 0.0;
            for ( var j = 0; j < windowSize/2; j++ )
            {
                normalised = fft.spectrum[j] * -1 * Math.log((fft.bufferSize/2 - j) * (0.5/fft.bufferSize/2)) * fft.bufferSize;
                //if (j % 100 == 0) console.log(normalised);

                totalEnergy += normalised;
                sum += j * normalised;
            }

            this.spectrumCentre[i] = (sum / totalEnergy) / (windowSize/2);
        }
        */

        if (this.onLoaded)
        {
            this.onLoaded(this);
        }
    }.bind(this));

    this.ready = function()
    {
        return this.buffer !== undefined;
    }
}

function removeAndAdd(string, remove, add)
{
    return string.replace(remove, "").replace(add, "") + add
}

function updateToggle(elementId, on)
{
    element = document.getElementById(elementId);

    if (element)
    {
        element.className = removeAndAdd(
            element.className,
            on ? " off" : " on",
            on ? " on" : " off"
        )
    }
}

function updateStyles()
{
    for (var section in toggleOptions)
    {
        for (var option in toggleOptions[section])
        {
            updateToggle(section+"-"+option, toggleOptions[section][option]);
        }
    }

    document.getElementById("stopTransport").style.display = playing ? "flex" : "none";
    document.getElementById("listenTransport").style.display = playing ? "none" : "flex";
    document.getElementById("recordTransport").style.display = playing ? "none" : "flex";
    document.getElementById("reviewTransport").style.display = playing ? "none" : "flex";
    //document.getElementById("recordings").style.display = playing ? "none" : "flex";
}

var playBufferCallback = undefined;
var stopBufferCallback = undefined;
var startTimeCallback = undefined;

function setPlayBufferCallback(callback)
{
    playBufferCallback = callback;
}

function setStopBufferCallback(callback)
{
    stopBufferCallback = callback;
}

function setStartTimeCallback(callback)
{
    startTimeCallback = callback;
}

function stopGui()
{
    playing = false;
    updateStyles();
    viewDirty = true;
    if (stopBufferCallback != undefined)
    {
        stopBufferCallback();
    }
}

function playBuffer(buffer, startTime, pan)
{
    console.log("pan: "+pan)
    player = audioContext.createBufferSource();

    player.buffer = buffer.buffer;

    panNode = audioContext.createStereoPanner();
    panNode.pan.value = pan;

    player.connect(panNode);
    panNode.connect(outputGain);

    player.start(
        startTime,
        startBeat * secondsPerBeat,
        (endBeat - startBeat) * secondsPerBeat);

    if (playBufferCallback != undefined)
    {
        playBufferCallback(startTime * 1000, startBeat + 5);
    }

    return player;
}

function playAll(startTime, pan)
{
    playBuffer(allBuffer, startTime, pan).onended = function ()
    {
        stopGui();
    };
}

function playPart(startTime, pan, buffer)
{
    if (buffer === undefined)
    {
        buffer = partBuffer;
    }

    console.log("Playing "+buffer.url)

    playBuffer(buffer, startTime, pan).onended = function ()
    {
        stopGui();
    };
}

function playRecording(startTime, pan)
{
    playBuffer(recordingBuffer, startTime, pan).onended = function ()
    {
        viewDirty = true;
        if (stopBufferCallback != undefined)
        {
            stopBufferCallback();
        }
    };
}

var audioInputs = [];
var recorders = [];

function recordPart(playStartTime)
{
    if (lastRecordStopTimeout !== undefined)
    {
        clearTimeout(lastRecordStopTimeout);
    }

    audioInput = audioContext.createMediaStreamSource(inputAudio);
    audioInputs.push(audioInput);

    frameSize = 2048;
    frameLength = frameSize / audioContext.sampleRate;
    secondsPerSample = 1.0 / audioContext.sampleRate;
    recordingFrameIndex = 0;

    recorder = audioContext.createScriptProcessor(frameSize, 2, 2);
    recorders.push(recorder);

    firstFrameTime = undefined;

    recorder.onaudioprocess = function (e)
    {
        frameTime = e.playbackTime - latencySeconds;

        if (frameTime > playStartTime)
        {
            if (firstFrameTime == undefined) firstFrameTime = frameTime;

            channelWriteOffset =
                    (startBeat * secondsPerBeat + (firstFrameTime - playStartTime) - latencySeconds)
                    * audioContext.sampleRate
                    + recordingFrameIndex * frameSize;

            if (channelWriteOffset >= 0)
            {
                recordingBuffer.buffer.copyToChannel(
                    new Float32Array(e.inputBuffer.getChannelData(0)),
                    0,
                    channelWriteOffset);

                recordingBuffer.maxSample = overviewBuffer(recordingBuffer.buffer, recordingBuffer.overview, channelWriteOffset, channelWriteOffset + frameSize);
            }

            recordingFrameIndex += 1;
        }
    }.bind(this)

    audioInput.connect(recorder);
    recorder.connect(outputGain);

    lastRecordStopTimeout = setTimeout(function ()
    {
        console.log("Stopping recording");
        audioInput.disconnect();
        recorder.disconnect();
    }.bind(this),
    ((endBeat - startBeat) * secondsPerBeat + playStartTime - audioContext.currentTime) * 1000 + 500);
}

function post(path, params) {
    method = "post"; // Set method to post by default if not specified.

    // The rest of this code assumes you are not using a library.
    // It can be made less wordy if you use one.
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);

    for(var key in params) {
        if(params.hasOwnProperty(key)) {
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", params[key]);

            form.appendChild(hiddenField);
         }
    }

    document.body.appendChild(form);
    form.submit();
}

function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}


function writeUTFBytes(view, offset, string){
    var lng = string.length;
    for (var i = 0; i < lng; i++){
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

////////////////////////////////////// Functions called from HTML

var fileDownloadUrls = undefined;
var fileUploadUrls = undefined;
var recordingShareUrls = undefined;
var fileUploadCsrfToken = undefined;
function configure(downloadUrls, uploadUrls, shareUrls, csrfToken)
{
    fileDownloadUrls = downloadUrls;
    fileUploadUrls = uploadUrls;
    fileUploadCsrfToken = csrfToken;
    recordingShareUrls = shareUrls;
}

function keep(id)
{
    if (recordingBuffer !== undefined)
    {
        console.log(recordingBuffer.buffer);
        console.log(recordingBuffer.buffer.getChannelData(0));
        soundArray = recordingBuffer.buffer.getChannelData(0);
        // create the buffer and view to create the .WAV file
        var buffer = new ArrayBuffer(44 + recordingBuffer.buffer.length * 2);
        var view = new DataView(buffer);

        // write the WAV container, check spec at: https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
        // RIFF chunk descriptor
        writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 44 + recordingBuffer.buffer.length * 2, true);
        writeUTFBytes(view, 8, 'WAVE');
        // FMT sub-chunk
        writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        // stereo (2 channels)
        view.setUint16(22, 1, true);
        view.setUint32(24, recordingBuffer.buffer.sampleRate, true);
        view.setUint32(28, recordingBuffer.buffer.sampleRate * 2, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        // data sub-chunk
        writeUTFBytes(view, 36, 'data');
        view.setUint32(40, recordingBuffer.buffer.length * 2, true);

        // write the PCM samples
        var lng = recordingBuffer.buffer.length;
        var index = 44;
        var volume = 1;
        for (var i = 0; i < lng; i++){
            view.setInt16(index, soundArray[i] * (0x7FFF * volume), true);
            index += 2;
        }

        // our final binary blob that we can hand off
        var blob = new Blob ( [ view ], { type : 'audio/wav' } );

        request = new XMLHttpRequest();
        formData  = new FormData();

        formData.append("recording", blob, "recording.wav");
        formData.append("csrfmiddlewaretoken", fileUploadCsrfToken);

        request.addEventListener('load', function(event) {
            document.write(this.responseText);
        });

        // We define what will happen in case of error
        request.addEventListener('error', function(event) {
            alert('Oups! Something goes wrong.');
        });

        request.open('POST', fileUploadUrls[id-1]);
        request.send(formData);
    }
}

function recall(id)
{
    if (recordingBuffer !== undefined)
    {
        loadAudio(fileDownloadUrls[id-1], function (buffer)
        {
            recordingBuffer.buffer = buffer;
            overviewBuffer(buffer, recordingBuffer.overview);
            viewDirty = true;
        });
    }
}

function share(id)
{
    url = recordingShareUrls[id-1];
    if (url !== "")
    {
        request = new XMLHttpRequest();

        request.addEventListener('load', function(event) {
            document.write(this.responseText);
        });

        request.addEventListener('error', function(event) {
            alert('Oups! Something goes wrong.');
        });

        request.open('GET', url);
        request.send();
    }
}

function toggle(section, option)
{
    console.assert (section in toggleOptions);
    console.assert (option in toggleOptions[section]);

    toggleOptions[section][option] = !toggleOptions[section][option];

    if (section == "record")
    {
        if (option == "hearAll" && toggleOptions.record.hearAll) toggleOptions.record.hearPart = false;
        if (option == "hearPart" && toggleOptions.record.hearPart) toggleOptions.record.hearAll = false;

        if (!toggleOptions.record.hearPart && !toggleOptions.record.hearAll && !isFreeform)
        {
            toggleOptions.record.hearMetronome = true;
        }
    }
    else if (section == "review")
    {
        if (option == "hearAll" && toggleOptions.review.hearAll) toggleOptions.review.hearPart = false;
        if (option == "hearPart" && toggleOptions.review.hearPart) toggleOptions.review.hearAll = false;
    }

    updateStyles();
}

function play()
{
    if (playing) return;

    playing = true;

    playStartTime = audioContext.currentTime

    playPart(playStartTime, 0.0);

    updateStyles();
}

function review()
{
    if (playing) return;

    playing = true;

    playStartTime = audioContext.currentTime

    playRecording(playStartTime, 0);

    if (toggleOptions.review.hearPart)
    {
        playPart(playStartTime, -0.5);
    }

    if (toggleOptions.review.hearAll)
    {
        playAll(playStartTime, 0.5);
    }

    updateStyles();
}

function record()
{
    if (playing) return;

    playing = true;

    timeSignatureAtStart = timeSignatureAtBeat(startBeat);
    startBeatInBar = timeSignatureAtStart.beatInBarAtBeat(startBeat);

    if (timeSignatureAtStart.beatsPerBar == 1) countIn = [ 4 ];
    else if (startBeatInBar == 0) countIn = [ timeSignatureAtStart.beatsPerBar ];
    else countIn = [ timeSignatureAtStart.beatsPerBar, startBeatInBar ];

    countInStartTime = audioContext.currentTime;
    countInTime = countIn.reduce(function(a, b) { return a + b; }) * secondsPerBeat;

    playStartTime = countInStartTime + countInTime

    if (toggleOptions.record.hearPart)
    {
        playPart(playStartTime, 0.0);
    }

    if (toggleOptions.record.hearAll)
    {
        playAll(playStartTime, 0.0);
    }

    recordPart(playStartTime);

    // Count in
    if (!isFreeform)
    {
        n = 0;
        countIn.forEach(function (count)
        {
            for (var i = 0; i < count; i++)
            {
                if (numberBuffers[i] !== undefined)
                {
                    player = audioContext.createBufferSource();
                    player.buffer = numberBuffers[i];

                    player.connect(outputGain);
                    player.start(countInStartTime + n * secondsPerBeat);
                }

                n += 1;
            }
        }.bind(this));
    }

    // Metronome
    if (toggleOptions.record.hearMetronome) {
        metronomeBeats = endBeat - startBeat + 1;
        for (var i = 0; i < metronomeBeats; i++)
        {
            player = audioContext.createBufferSource();
            player.buffer = metronomeBuffer;

            player.connect(outputGain);
            player.start(playStartTime + i * secondsPerBeat);
            if (i == metronomeBeats - 1)
            {
                player.onended = function ()
                {
                    playing = false;
                    updateStyles();
                    viewDirty = true;
                }
            }
        }
    }

    updateStyles();
}

function stop()
{
    outputGain.disconnect();
    outputGain = audioContext.createGain();
    outputGain.connect(audioContext.destination);

    for (var i = 0; i < audioInputs.length; i++)
    {
        audioInputs[i].disconnect();
    }

    for (var i = 0; i < recorders.length; i++)
    {
        recorders[i].disconnect();
    }

    audioInputs = [];
    recorders = [];

    stopGui();
}

function configureSong(allRecordingUrl, partRecordingUrl, otherPartRecordingUrls, metronomeUrl, numberUrls, songTempo, inputLatency, isFreeformArg, midiFileUrl)
{
    tempo = songTempo;
    isFreeform = isFreeformArg;
    secondsPerBeat = 60.0/tempo;
    allBuffer = new AudioBuffer(allRecordingUrl);
    latencySeconds = inputLatency;

    partBuffer = new AudioBuffer(partRecordingUrl, midiFileUrl, function(audioBuffer)
    {
        lengthInSeconds = audioBuffer.buffer.duration;
        lengthInBeats = Math.floor(audioBuffer.buffer.duration / secondsPerBeat);
        setEndBeat(lengthInBeats);
        begin();

        recordingBuffer = new RecordingBuffer(audioBuffer.buffer.length);
    }, 5 /*smoothing*/);

    otherPartRecordingBuffers = [];
    otherPartRecordingUrls.forEach(function (otherPartRecordingUrl, index)
    {
        otherPartRecordingBuffers.push(new AudioBuffer(otherPartRecordingUrl));
    });

    loadAudio(metronomeUrl, function (buffer)
    {
        metronomeBuffer = buffer;
    });

    for (var i = 0; i < 4; i++)
    {
        numberBuffers.push(undefined);

        loadAudio(numberUrls[i], function (n, buffer)
        {
            numberBuffers[n] = buffer;
        }.bind(undefined, i));
    }
}

function addSection(name, start, end, lyrics)
{
    sections.push(new Section(name, start, end, lyrics));
    sections.sort(function (a,b) { return a.start - b.start });
}

function addTimeSignature(startBeatInSong, startBeatInBar, beatsPerBar)
{
    timeSignatures.push(new TimeSignature(startBeatInSong, startBeatInBar, beatsPerBar));
    timeSignatures.sort(function (a,b) { return b.startBeatInSong - a.startBeatInSong });
}

var viewDirty = true;

function drawLoadingCanvas()
{
    canvas.width  = window.innerWidth - 30;
    context.fillStyle = '#eeeeee';
    context.globalAlpha = 1.0;
    context.fillRect(0, 0, canvas.width, canvas.height);

    text = "Preparing audio... won't be long..."
    context.font="20px Work Sans";
    textWidth = context.measureText(text).width;
    context.fillStyle = '#333333';
    context.fillText(text, canvas.width/2 - textWidth/2, 60)
}

function animate()
{
    requestAnimFrame(function()
    {
        animate();
    });

    if (!playing && !viewDirty) return;

    timelineTop = canvas.height - timelineHeight;

    canvas.width  = window.innerWidth - 30;
    selectionColour = '#aaaaaa';

    context.fillStyle = '#eeeeee';
    context.globalAlpha = 1.0;
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (partBuffer.ready())
    {
        waveformBottom = timelineTop - 2;

        selectedLeft = beatsToX(startBeat);
        selectedRight = beatsToX(endBeat);
        selectedWidth = selectedRight - selectedLeft;
        waveformWidth = canvas.width - xMargins;

        context.globalAlpha = 1.0;
        if (recordingBuffer !== undefined && recordingBuffer.overview !== undefined)
        {
            context.strokeStyle = "#7788ff";
            for(var x = 0; x < waveformWidth; x+=2)
            {
                sample = Math.floor((x / waveformWidth) * 1000);
                context.beginPath();
                context.moveTo(xMargin + x+0.5, waveformBottom - recordingBuffer.overview[sample] * (canvas.height - timelineHeight - 5));
                context.lineTo(xMargin + x+0.5, waveformBottom);
                context.stroke();
            }
        }

        context.fillStyle = 'black';
        context.strokeStyle = 'black';

        /*
        context.beginPath();
        context.moveTo(0, 100);

        for(var x = 0; x < canvas.width; x+=1)
        {
            sample = Math.floor((x / canvas.width) * 1000);
            context.lineTo(x, 100 + partBuffer.overview[sample] * 50);
        }
        context.stroke();
        */

        // Draw the volume line
        {
            context.beginPath();
            context.moveTo(0, waveformBottom);

            scale = partBuffer.midiNotes ? 0.5 : 1.0;

            for(var x = 0; x < waveformWidth; x+=2)
            {
                sample = Math.floor((x / waveformWidth) * 1000);

                context.lineTo(x + xMargin, waveformBottom - partBuffer.overview[sample] / partBuffer.maxSample * (canvas.height * scale - timelineHeight - 5));
            }
            context.lineTo(canvas.width, waveformBottom);
            context.stroke();
        }

        // Draw the notes
        if (partBuffer.midiNotes)
        {
            tailThinness = 0.85;
            partBuffer.midiNotes.forEach(function (note)
            {
                if (note.end != undefined)
                {
                    xStart = Math.round(timeToX(note.start / 1000));
                    xEnd = Math.round(timeToX(note.end / 1000));
                    y = Math.round(100 - (note.pitch - partBuffer.lowNote) / (partBuffer.highNote - partBuffer.lowNote) * 95);

                    if (false)
                    {
                        xEnd = Math.max(xEnd, xStart + 4);
                        context.fillRect(xStart, y - 2, xEnd - xStart - 2, 4);
                        context.beginPath();
                        context.arc(xEnd - 2, y, 2, 0, 2*Math.PI);
                        context.fill();
                    }

                    if (false)
                    {
                        xEnd = Math.max(xStart + 5, xEnd);
                        context.beginPath();
                        context.moveTo(xStart, y);
                        context.quadraticCurveTo(xStart, y + 3, xStart + 2, y + 3);
                        context.bezierCurveTo(
                            xEnd - (xEnd - xStart - 4) * tailThinness, y + 3,
                            xEnd - (xEnd - xStart - 4) * tailThinness, y,
                            xEnd, y);
                        context.bezierCurveTo(
                            xEnd - (xEnd - xStart - 4) * tailThinness, y,
                            xEnd - (xEnd - xStart - 4) * tailThinness, y - 3,
                            xStart + 2, y - 3);
                        context.quadraticCurveTo(xStart, y - 3, xStart, y);
                        context.closePath();
                        context.fill();
                    }

                    if (false)
                    {
                        xEnd = Math.max(xStart + 5, xEnd);
                        context.beginPath();
                        context.moveTo(xStart, y+3);
                        context.quadraticCurveTo(
                            xStart+3, y,
                            xEnd, y);
                        context.quadraticCurveTo(
                            xStart+3, y,
                            xStart, y-3);
                        context.closePath();
                        context.fill();
                    }

                    if (true)
                    {
                        context.fillStyle = '#999999';
                        context.lineWidth = 2;
                        xEnd = Math.max(xStart + 5, xEnd);
                        context.beginPath();
                        context.moveTo(xStart, y+3);
                        context.quadraticCurveTo(
                            xEnd, y+3,
                            xEnd, y);
                        context.quadraticCurveTo(
                            xEnd, y-3,
                            xStart, y-3);
                        context.closePath();
                        context.fill();

                        context.strokeStyle = 'black';
                        context.beginPath();
                        context.moveTo(xStart+1, y+3);
                        context.lineTo(xStart+1, y-3);
                        context.stroke();
                    }

                }
            });
        }


        context.fillStyle = selectionColour;

        context.fillStyle = 'black';
        context.strokeStyle = 'black';
        context.globalAlpha = 1.0;
        context.font="300 20px Work Sans";

        sections.forEach(function (section, index)
        {
            startX = beatsToX(section.start);
            endX = beatsToX(section.end);

            if (index == 0)
            {
                context.beginPath();
                context.moveTo(startX+0.5, 0);
                context.lineTo(startX+0.5, canvas.height);
                context.stroke();
            }

            context.fillText(section.name, startX + 5, canvas.height - 5);

            context.beginPath();
            context.moveTo(endX+0.5, 0);
            context.lineTo(endX+0.5, canvas.height);
            context.stroke();
        });

        if (isStaff)
        {
            timeSignatures.forEach(function (timeSignature, index)
            {
                x = beatsToX(timeSignature.startBeatInSong);

                context.beginPath();
                context.moveTo(x+0.5, 0);
                context.lineTo(x+0.5, 25);
                context.stroke();

                context.fillText(""+timeSignature.beatsPerBar+" bpb starting "+(timeSignature.startBeatInBar+1), x + 5, 20);
            });
        }

        context.fillStyle = "#ffffff";
        context.globalAlpha = 0.7;

        context.fillRect(
            0,
            0,
            selectedLeft,
            canvas.height);

        context.fillRect(
            selectedRight,
            0,
            canvas.width - selectedRight,
            canvas.height);

        if (mouseOverCanvas)
        {
            context.fillStyle = selectionColour;
            context.globalAlpha = 1.0;
            markerHeight = canvas.height;
            context.fillRect(
                selectedLeft-2,
                canvas.height - markerHeight,
                5,
                markerHeight);

            context.fillRect(
                selectedRight - 2,
                canvas.height - markerHeight,
                5,
                markerHeight);
        }
    }

    if (playing)
    {
        context.fillStyle = '#777777';
        context.globalAlpha = 0.5;
        bufferPlayX = timeToX(audioContext.currentTime - playStartTime + startBeat * secondsPerBeat);

        context.fillRect(
            bufferPlayX-1,
            0,
            2,
            canvas.height);
    }

    viewDirty = false;
}

