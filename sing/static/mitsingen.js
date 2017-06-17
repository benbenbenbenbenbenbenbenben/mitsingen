
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
        alert('Error capturing audio.');
    });

window.requestAnimFrame = (function(callback)
{
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
    function(callback) {
      window.setTimeout(callback, 1000 / 10);
    };
})();

function draw()
{
    context.fillStyle = 'black';
    context.fillRect(0, 0, 200, 200);
}

playPart = 0
record = 1
playAll = 2
playbackRecording = 3
countIn = 4
metronome = 5
startNote = 5

var latency = 0.505

function setLatency()
{
    latency = parseFloat(document.getElementById("latency").value)/1000;
    document.cookie=""+latency;
    console.log("Set latency "+latency)
}

var numberBuffers = []

for (var i = 0; i < 4; i++)
{
    numberBuffers.push(undefined);

    loadAudio(""+(i+1)+".mp3", function (n, buffer)
    {
        console.log("Loaded number "+n)
        numberBuffers[n] = buffer;
    }.bind(undefined, i));
}

var metronomeName = "metronome_tock.mp3"
var metronomeBuffer = undefined

noState = "no"
listenState = "listen"
startNoteState = "startNote"
singWithPartState = "singWithPart"
singAloneState = "singAlone"
singWithChoirState = "singWithChoir"
compareRecordingState = "compareRecording"
hearRecordingState = "hearRecording"

var nextSongId = 0;
function Song(name, note, allName, tempo, parts)
{
    this.id = nextSongId;
    nextSongId += 1;
    this.name = name;
    this.parts = parts;
    this.note = note;

    parts.forEach(function (part)
    {
        part.song = this;
        part.sections.forEach(function (section)
        {
            section.tempo = tempo;
        });
    }.bind(this));

    this.loadAudio = function ()
    {
        loadAudio(allName, function (buffer)
        {
            parts.forEach(function (part)
            {
                part.sections.forEach(function (section)
                {
                    section.allBuffer = buffer;
                });
            });
        }.bind(this));
    }
}

var nextPartId = 0;
function Part(name, partName, sections)
{
    this.id = nextPartId;
    nextPartId += 1;
    this.name = name;
    this.sections = sections;

    sections.forEach(function (section)
    {
        section.part = this;
    }.bind(this));

    this.getHtml = function ()
    {
        html = "<h1>"+this.song.name+": "+this.name+"</h1>"

        html += "<p>"+this.song.note+"</p>"

        this.sections.forEach(function (section)
        {
            html += section.getHtml();
        }.bind(this));

        loadAudio(partName, function (buffer)
        {
            console.log("Loaded "+partName);

            this.sections.forEach(function (section)
            {
                section.partBuffer = buffer;
            });
        }.bind(this));

       html += "<h2>&ldquo;Compare recording&rdquo; synchronisation help</h2>"
        html += "<p><b>Increase</b> this number if you hear the recording <b>before</b> your voice when comparing recordings.</p>"
        html += "<p><b>Decrease</b> this number if you hear the recording <b>after</b> your voice when comparing recordings.</p>"
        html += "<form id='latencyForm'  onsubmit='return false;'>Latency: <input id='latency' onchange='setLatency()' type=text size=3 value="+(latency * 1000)+"></form>"
        html += "<p>The number is in thousandths of a second. Sensible numbers are between 0 and 2000. Change in steps of around 200 initially, reducing the steps as you get more synchronised. The setting only has an effect when you make a new recording. Once you've found the right number, it will be remembered and you shouldn't need to change it. Good luck!</p>"

        this.song.loadAudio();

        return html;
    }
}

var nextSectionId = 0;
function Section(name, countInBeats, startBeats, lengthBeats, subsectionsBeats)
{
    this.id = nextSectionId;
    nextSectionId += 1;
    this.name = name;
    this.startBeats = startBeats;
    this.countInBeats = countInBeats;
    this.lengthBeats = lengthBeats;

    if (subsectionsBeats === undefined) {
        this.subsectionsBeats = [];
    }
    else {
        this.subsectionsBeats = subsectionsBeats;
    }

    this.startNoteBeats = 1.0;
    this.partBuffer = undefined;
    this.allBuffer = undefined;
    this.state = noState;

    this.recording = [];
    this.recordingTriggerTime = undefined;
    this.recordingStartTime = undefined;
    this.recordingPartStartTime = undefined;
    this.recordingBuffer = undefined;

    this.lastStartGain = undefined;
    this.lastRecordStopTimeout = undefined;

    this.getPartIndex = function()
    {
        return this.part.song.parts.indexOf(this.part);
    }

    this.getSectionIndex = function()
    {
        return this.part.sections.indexOf(this)
    }

    this.getIdForState = function (state) {
        return ""+this.part.song.id+"."+this.part.id+"."+this.id+"."+state;
    }

    this.getStartClassNameForState = function (state) {
        className = state+" start";

        if (this.recordingBuffer === undefined &&
            (state == compareRecordingState || state == hearRecordingState))
        {
            className += " inactive";
        }

        if (this.state == state)
        {
            className += " running";
        }

        return className;
    }

    this.setStartClassName = function (state) {
        if (state == noState) return;

        className = this.getStartClassNameForState(state);
        console.log("Setting "+this.getIdForState(state)+" to "+className);

        document.getElementById(this.getIdForState(state)).className = className;
    }

    this.getHtml = function() {
        var html = ""

        html += "<h2 class='sectionName'>"+this.name+"</h2>"

        states = [ listenState, startNoteState, singWithPartState, singAloneState, singWithChoirState, compareRecordingState, hearRecordingState ]
        stateTexts = [ "Listen", "Start note", "Sing with your part", "Sing alone", "Sing with choir", "Compare recording", "Hear recording" ]

        for (var i = 0; i < states.length; i++)
        {
            state = states[i];
            stateText = stateTexts[i];
            console.log(state)

            className = this.getStartClassNameForState(state);

            html += "<span class='"+className+"' id='"+this.getIdForState(state)+"' onclick='songs["+songs.indexOf(this.part.song)+"].parts["+this.getPartIndex()+"].sections["+this.getSectionIndex()+"].toggleState(\""+state+"\")'>"+stateText+"</span>\n"
        }

        console.log(html)

        return html;
    }

    this.playStartNote = function () {
        secondsPerBeat = 60.0/this.tempo
        player = audioContext.createBufferSource();
        player.buffer = this.partBuffer;

        player.connect(audioContext.destination);
        player.start(audioContext.currentTime, this.startBeats * secondsPerBeat, this.startNoteBeats * secondsPerBeat);
        player.onended = this.clearState.bind(this);
    }

    this.toggleState = function (state) {
        console.log("Toggle state "+state);
        this.stop();
        if (this.state === state) {
            oldState = this.state;
            this.state = noState;
            this.setStartClassName(oldState)
        }
        else {
            oldState = this.state;
            this.state = state;
            this[state]();
            this.setStartClassName(oldState)
            this.setStartClassName(this.state)
        }
    }

    this.clearState = function ()
    {
        oldState = this.state;
        this.stop();
        this.state = noState;
        this.setStartClassName(oldState)
    }

    this.listen = function ()
    {
        this.start([ playPart ]);
    }

    this.startNote = function ()
    {
        this.playStartNote();
    }

    this.singWithPart = function ()
    {
        this.start([ countIn, metronome, playPart, record ]);
    }

    this.singAlone = function ()
    {
        this.start([ countIn, metronome, record ]);
    }

    this.singWithChoir = function ()
    {
        this.start([ countIn, playAll, record ]);
    }

    this.compareRecording = function ()
    {
        this.start([ playPart, playbackRecording ]);
    }

    this.hearRecording = function ()
    {
        this.start([ playbackRecording ]);
    }


    this.stop = function () {
        if (this.lastRecordStopTimeout !== undefined)
        {
            clearTimeout(this.lastRecordStopTimeout);
            this.lastRecordStopTimeout = undefined;
        }

        if (this.lastStartGain !== undefined)
        {
            this.lastStartGain.disconnect();
            this.lastStartGain = undefined;
        }
    }

    this.start = function (actions) {
        if (actions.contains(playbackRecording) && this.recordingBuffer === undefined) return;

        console.log("listen "+this.name);

        this.lastStartGain = audioContext.createGain();
        outputGain = this.lastStartGain;

        outputGain.connect(audioContext.destination);


        secondsPerBeat = 60.0/this.tempo
        countInTime = this.countInBeats.reduce(function(a, b) { return a + b; }) * secondsPerBeat;
        startNoteTime = this.startNoteRepetitions * this.startNoteBeats * secondsPerBeat

        playDelay = actions.contains(countIn) ? countInTime : 0
        playStartTime = audioContext.currentTime + playDelay;
        partStartTime = playStartTime;

        if (actions.contains(playbackRecording))
        {
            partStartTime += this.recordingPartStartTime - this.recordingStartTime;
        }

        if (actions.contains(record)) this.recordingPartStartTime = partStartTime;

        // Count in

        if (actions.contains(countIn))
        {
            console.log("countIn "+this.name);
            n = 0;

            this.countInBeats.forEach(function (count)
            {
                for (var i = 0; i < count; i++)
                {
                    player = audioContext.createBufferSource();
                    player.buffer = numberBuffers[i];

                    player.connect(outputGain);
                    player.start(partStartTime - countInTime + n * secondsPerBeat);

                    n += 1;
                }
            }.bind(this));
        }

        // Metronome

        if (actions.contains(metronome))
        {
            for (var i = 0; i < lengthBeats; i++)
            {
                player = audioContext.createBufferSource();
                player.buffer = metronomeBuffer;

                player.connect(outputGain);
                player.start(partStartTime + i * secondsPerBeat);

                if (this.subsectionsBeats.indexOf(i+1+this.startBeats) !== -1)
                {
                    player = audioContext.createBufferSource();
                    player.buffer = metronomeBuffer;

                    player.connect(outputGain);
                    player.start(partStartTime + i * secondsPerBeat + secondsPerBeat*0.25);
                }
            }
        }

        // Play part or all

        if (actions.contains(playPart) || actions.contains(playAll))
        {
            console.log("playPart "+this.name);
            player = audioContext.createBufferSource();

            if (actions.contains(playPart)) player.buffer = this.partBuffer;
            else player.buffer = this.allBuffer;

            pan = audioContext.createStereoPanner();
            pan.pan.value = actions.contains(playbackRecording) ? -0.8 : 0

            player.connect(pan);
            pan.connect(outputGain);

            player.start(partStartTime, this.startBeats * secondsPerBeat, this.lengthBeats * secondsPerBeat);

            if (!actions.contains(record) && !actions.contains(playbackRecording))
            {
                player.onended = this.clearState.bind(this);
            }
        }

        // Recording

        if (actions.contains(record) && inputAudio !== undefined)
        {
            console.log("record "+this.name);

            this.recordingTriggerTime = audioContext.currentTime;

            audioInput = audioContext.createMediaStreamSource(inputAudio);

            frameSize = 2048*4;
            secondsPerSample = 1.0 / audioContext.sampleRate;

            recorder = audioContext.createScriptProcessor(frameSize, 2, 2);
            this.recording = [];
            this.recordingBuffer = undefined;
            // Disable playback buttons
            this.setStartClassName(compareRecordingState);
            this.setStartClassName(hearRecordingState);
            this.recordingStartTime = undefined;
            recorder.onaudioprocess = function (e)
            {
                if (e.playbackTime - latency + frameSize * secondsPerSample > this.recordingPartStartTime)
                {
                    // We might have started getting audio that came into the mic
                    // after the user heard the part start and started singing themselves

                    if (this.recordingStartTime === undefined)
                    {
                        // Should be negative, ie. recording started before playback
                        this.recordingStartTime = e.playbackTime - latency;
                        console.log("this.recordingStartTime: "+this.recordingStartTime)
                        console.log(" ... relative to this.recordingTriggerTime: "+(this.recordingStartTime - this.recordingTriggerTime))
                    }

                    this.recording.push(new Float32Array(e.inputBuffer.getChannelData(0)));
                }
            }.bind(this)

            audioInput.connect(recorder);
            recorder.connect(outputGain);

            this.lastRecordStopTimeout = setTimeout(function ()
            {
                console.log("Stopping recording - creating recording buffer");
                this.recordingBuffer = audioContext.createBuffer(1,
                    frameSize * this.recording.length,
                    audioContext.sampleRate);

                // Enable playback buttons
                this.setStartClassName(compareRecordingState);
                this.setStartClassName(hearRecordingState);

                this.recording.forEach(function (frame, index)
                {
                    this.recordingBuffer.copyToChannel(frame, 0, index * frameSize);
                }.bind(this));

                audioInput.disconnect();
                recorder.disconnect();
                this.clearState();
            }.bind(this),
            (partStartTime - audioContext.currentTime + this.lengthBeats * secondsPerBeat) * 1000 + 500);
        }

        // Play recording

        if (actions.contains(playbackRecording) && this.recordingBuffer !== undefined)
        {
            console.log("playbackRecording "+this.name);
            player = audioContext.createBufferSource();
            player.buffer = this.recordingBuffer;

            pan = audioContext.createStereoPanner();
            pan.pan.value = actions.contains(playPart) ? 0.8 : 0

            player.connect(pan);
            pan.connect(outputGain);
            player.start(playStartTime);
            player.onended = this.clearState.bind(this);
        }
    }
}

loadAudio(metronomeName, function (buffer)
{
    metronomeBuffer = buffer;
});

Array.prototype.contains = function(o)
{
    return this.indexOf(o) > -1;
}

