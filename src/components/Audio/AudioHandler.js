export class AudioHandler {
	constructor(){
		//Global variables
		//
		this.SampleRate = 16000; 		// Global sample rate used for all audio
		this.PacketSize = 500;			// Server packet size we must conform to
		this.chunkSize = 1024;			// Audio chunk size. Fixed by js script processor
		this.soundcardSampleRate = null; 	// Get this from context 
		this.resampledChunkSize = 0;		// Once resampled the chunks are this size
		this.socketConnected = false; 		// True when socket is up
		this.micAccessAllowed = false; 		// Need to get user permission
		this.spkrBuffer = []; 			// Audio buffer going to speaker
		this.maxBuffSize = 5000;			// Max audio buffer chunks for playback
		this.micBuffer = [];			// Buffer mic audio before sending

		// Timing counters
		//
		// We use these to measure how many miliseconds we spend working on events
		// and how much time we spend doing "nothing" (supposedly idle)
		this.idleState = this.stateTimer(); 		this.idleState.name = "Idle";
		this.dataInState = this.stateTimer();		this.dataInState.name = "Data In";
		this.audioInOutState = this.stateTimer();	this.audioInOutState.name = "Audio In/Out";
		this.currentState = this.idleState;		this.currentState.start = new Date().getTime();

		// Reporting code. Accumulators, interval timer and report generator
		//
		this.packetsIn = 0;
		this.packetsOut = 0;
		this.overflows = 0;
		this.shortages = 0;
		this.packetSequence = 0;			// Tracing packet ordering
		this.currentSeq = 0;			// Last packet sequence received
		this.seqGap = 0;				// Accumulators for round trip measurements
		this.timeGap = 0;
		this.seqStep = 0;

		this.downCache = [0.0,0.0];
		this.upCache = [0.0,0.0];
		
		this.socketId = "";
		setInterval(this.printReport.bind(this), 10000);
	}
	setSocketId(socketId){
		this.socketId = socketId;
	}
	printReport() {
		console.log("Idle = ", this.idleState.total, " data in = ", this.dataInState.total, " audio in/out = ", this.audioInOutState.total);
		console.log("Sent = ",this.packetsOut," Heard = ",this.packetsIn," speaker buffer size ",this.spkrBuffer.length," mic buffer size ", this.micBuffer.length," overflows = ",this.overflows," shortages = ",this.shortages);
		this.packetsIn = 0;
		this.packetsOut = 0;
		this.overflows = 0;
		this.shortages = 0;
		this.timeGap = 0;
	}

	stateTimer() {
		return {
			name:"",
			total:0,
			start:0
		}
	}
	enterState( newState ) {
		let now = new Date().getTime();
		this.currentState.total += now - this.currentState.start;
		newState.start = now;
		this.currentState = newState;
	}
	playAudio(data){
		this.enterState( this.dataInState );
		this.packetsIn++;
		if (this.micAccessAllowed) {	// Need access to audio before outputing
			let mix = new Array(this.PacketSize).fill(0);	// Build up a mix of client audio 
			let clients = data.c; 
			data.c.forEach( (client) => { 
				if (client.clientID != this.socketId) {
					let a = client.packet.audio;
					this.timeGap += new Date().getTime() - client.packet.timeEmitted;
					a.forEach((v,index) => {
						mix[index] += v*client.volume;
					});
				}
			});
			if (mix.length != 0) {
				this.spkrBuffer.push(...mix);
				if (this.spkrBuffer.length > this.maxBuffSize) {
					this.spkrBuffer.splice(0, (this.spkrBuffer.length-this.maxBuffSize)); 	
					this.overflows++;
				}
			}
		}
		this.enterState( this.idleState );
	}

	// Need function to receive UI position updates in order to rebuild audio mix table
	// and to send the new UI position out to the other clients


	// Media management code (audio in and out)
	//
	hasGetUserMedia() {		// Test for browser capability
		return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia || navigator.msGetUserMedia);
	}

	recordAudio(callback) {
		if (this.hasGetUserMedia()) {
			let context = new window.AudioContext || new window.webkitAudioContext;
			this.soundcardSampleRate = context.sampleRate;
			let constraints = { mandatory: {
						googEchoCancellation: true,
						googAutoGainControl: false,
						googNoiseSuppression: false,
						googHighpassFilter: false
					}, optional: [] };
			navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
			navigator.getUserMedia({ audio: constraints },(stream) => {
				this.micAccessAllowed = true;
				let liveSource = context.createMediaStreamSource(stream);
				let node = undefined;
				if (!context.createScriptProcessor) {
					node = context.createJavaScriptNode(this.chunkSize, 1, 1);
				} else {
					node = context.createScriptProcessor(this.chunkSize, 1, 1);
				}
				node.onaudioprocess = (e) => {
					this.enterState( this.audioInOutState );
					let inData = e.inputBuffer.getChannelData(0);
					let outData = e.outputBuffer.getChannelData(0);
					let micAudio = this.downSample(inData, this.soundcardSampleRate, this.SampleRate);
					this.resampledChunkSize = micAudio.length;
					this.micBuffer.push(...micAudio);
					if (this.micBuffer.length > this.PacketSize) {
						let outAudio = this.micBuffer.splice(0, this.PacketSize);
						callback({
							"audio": outAudio,
							"sequence": this.packetSequence,
							"timeEmitted": new Date().getTime()
						});
						this.packetsOut++;
						this.packetSequence++;
					}
					let inAudio = [];
					if (this.spkrBuffer.length > this.resampledChunkSize) 
						inAudio = this.spkrBuffer.splice(0,this.resampledChunkSize);
					else {	
						inAudio = this.spkrBuffer.splice(0,this.spkrBuffer.length);
						let zeros = new Array(this.resampledChunkSize-this.spkrBuffer.length).fill(0);
						inAudio.push(...zeros);
						this.shortages++;
					}
					let spkrAudio = this.upSample(inAudio, this.SampleRate, this.soundcardSampleRate);
					for (let i in outData) 
						outData[i] = spkrAudio[i];
					this.enterState( this.idleState );
				}
				liveSource.connect(node);
				node.connect(context.destination);
			},(err) => { console.log(err); });
		} else {
			alert('getUserMedia() is not supported in your browser');
		}
	}

	// Resamplers
	//
	downSample( buffer, originalSampleRate, resampledRate) {
		let resampledBufferLength = Math.round( buffer.length * resampledRate / originalSampleRate );
		let resampleRatio = buffer.length / resampledBufferLength;
		let outputData = new Array(resampledBufferLength).fill(0);
		for ( let i = 0; i < resampledBufferLength - 1; i++ ) {
			let resampleValue = ( resampleRatio - 1 ) + ( i * resampleRatio );
			let nearestPoint = Math.round( resampleValue );
			for ( let tap = -1; tap < 2; tap++ ) {
				let sampleValue = buffer[ nearestPoint + tap ];
				if (isNaN(sampleValue)) sampleValue = this.upCache[ 1 + tap ];
					if (isNaN(sampleValue)) sampleValue = buffer[ nearestPoint ];
				outputData[ i ] += sampleValue * this.magicKernel( resampleValue - nearestPoint - tap );
			}
		}
		this.downCache[ 0 ] = buffer[ buffer.length - 2 ];
		this.downCache[ 1 ] = outputData[ resampledBufferLength - 1 ] = buffer[ buffer.length - 1 ];
		return outputData;
	}

	upSample( buffer, originalSampleRate, resampledRate) {
		let resampledBufferLength = this.chunkSize;		// Forcing to always fill the outbuffer fully
		let resampleRatio = buffer.length / resampledBufferLength;
		let outputData = new Array(resampledBufferLength).fill(0);
		for ( let i = 0; i < resampledBufferLength - 1; i++ ) {
			let resampleValue = ( resampleRatio - 1 ) + ( i * resampleRatio );
			let nearestPoint = Math.round( resampleValue );
			for ( let tap = -1; tap < 2; tap++ ) {
				let sampleValue = buffer[ nearestPoint + tap ];
				if (isNaN(sampleValue)) sampleValue = this.upCache[ 1 + tap ];
					if (isNaN(sampleValue)) sampleValue = buffer[ nearestPoint ];
				outputData[ i ] += sampleValue * this.magicKernel( resampleValue - nearestPoint - tap );
			}
		}
		this.upCache[ 0 ] = buffer[ buffer.length - 2 ];
		this.upCache[ 1 ] = outputData[ resampledBufferLength - 1 ] = buffer[ buffer.length - 1 ];
		return outputData;
	}

	// From http://johncostella.webs.com/magic/
	magicKernel( x ) {
	  if ( x < -0.5 ) {
	    return 0.5 * ( x + 1.5 ) * ( x + 1.5 );
	  }
	  else if ( x > 0.5 ) {
	    return 0.5 * ( x - 1.5 ) * ( x - 1.5 );
	  }
	  return 0.75 - ( x * x );
	}
}
export default AudioHandler;
