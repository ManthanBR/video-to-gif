const { createFFmpeg, fetchFile } = FFmpeg;
let ffmpeg;

// DOM Elements
const videoFileInput = document.getElementById('videoFile');
const convertToGifButton = document.getElementById('convertToGifButton');
// const startTimeInput = document.getElementById('startTime'); // REMOVED
const fpsInput = document.getElementById('fps');
const scaleWidthInput = document.getElementById('scaleWidth');
const compressOutputCheckbox = document.getElementById('compressOutput');
const statusMessage = document.getElementById('statusMessage');
const progressBar = document.getElementById('progressBar');
const gifPreview = document.getElementById('gifPreview');
const downloadLink = document.getElementById('downloadLink');

let selectedFile = null;

async function initFFmpeg() {
    if (!ffmpeg || !ffmpeg.isLoaded()) {
        statusMessage.textContent = 'Loading FFmpeg-core.js...';
        progressBar.style.display = 'block';
        progressBar.value = 0;
        ffmpeg = createFFmpeg({
            log: true,
            progress: ({ ratio }) => {
                progressBar.value = ratio * 100;
                if (ratio === 1) {
                    statusMessage.textContent = 'Processing complete. Finalizing GIF...';
                } else if (ratio > 0) {
                    statusMessage.textContent = `Processing... ${Math.round(ratio * 100)}%`;
                }
            },
        });
        await ffmpeg.load();
        statusMessage.textContent = 'FFmpeg loaded. Ready to convert.';
        progressBar.style.display = 'none';
    }
}

videoFileInput.addEventListener('change', async (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        convertToGifButton.disabled = false;
        statusMessage.textContent = `Selected: ${selectedFile.name}. Click convert!`;
        gifPreview.style.display = 'none';
        downloadLink.style.display = 'none';
        await initFFmpeg();
    } else {
        convertToGifButton.disabled = true;
        statusMessage.textContent = 'Select a video to begin.';
    }
});

convertToGifButton.addEventListener('click', async () => {
    if (!selectedFile) {
        alert('Please select a video file first.');
        return;
    }
    if (!ffmpeg || !ffmpeg.isLoaded()) {
        statusMessage.textContent = 'FFmpeg not loaded. Please wait or refresh.';
        await initFFmpeg();
        if (!ffmpeg.isLoaded()) return;
    }

    convertToGifButton.disabled = true;
    statusMessage.textContent = 'Starting conversion...';
    progressBar.style.display = 'block';
    progressBar.value = 0;
    gifPreview.style.display = 'none';
    downloadLink.style.display = 'none';

    try {
        const inputFileName = 'inputVideo';
        const outputFileName = 'output.gif';

        ffmpeg.FS('writeFile', inputFileName, await fetchFile(selectedFile));
        statusMessage.textContent = 'Video loaded into memory. Preparing command...';

        // const startTime = parseFloat(startTimeInput.value) || 0; // REMOVED
        const fps = parseInt(fpsInput.value) || 10;
        const scaleWidth = parseInt(scaleWidthInput.value) || 320;
        const shouldCompress = compressOutputCheckbox.checked;

        const ffmpegArgs = [];
        // if (startTime > 0) { // REMOVED START TIME LOGIC
        //     ffmpegArgs.push('-ss', startTime.toString());
        // }
        ffmpegArgs.push('-i', inputFileName); // Input file is now always processed from the beginning

        let vfFilter = `fps=${fps},scale=${scaleWidth}:-1:flags=lanczos`;

        if (shouldCompress) {
            vfFilter += `,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
        } else {
            vfFilter += `,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
        }

        ffmpegArgs.push('-vf', vfFilter);
        ffmpegArgs.push('-loop', '0', outputFileName);

        statusMessage.textContent = `Running FFmpeg command... This may take a while. ${shouldCompress ? '(Compression enabled)' : ''}`;
        console.log('FFmpeg command:', ['ffmpeg', ...ffmpegArgs].join(' '));

        await ffmpeg.run(...ffmpegArgs);
        statusMessage.textContent = 'Conversion successful! Reading GIF...';

        const data = ffmpeg.FS('readFile', outputFileName);
        const gifUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'image/gif' }));

        gifPreview.src = gifUrl;
        gifPreview.style.display = 'block';

        downloadLink.href = gifUrl;
        downloadLink.download = `${selectedFile.name.split('.')[0]}${shouldCompress ? '_compressed' : ''}_animated.gif`;
        downloadLink.style.display = 'block';

        statusMessage.textContent = 'GIF generated successfully!';

    } catch (error) {
        console.error('Error during conversion:', error);
        statusMessage.textContent = `Error: ${error.message || 'Conversion failed. Check console.'}`;
        alert(`An error occurred: ${error.message || 'Unknown error'}`);
    } finally {
        convertToGifButton.disabled = false;
        if (selectedFile) convertToGifButton.disabled = false;
        progressBar.style.display = 'none';
    }
});

window.addEventListener('load', async () => {
    statusMessage.textContent = 'Ready. Select a video or FFmpeg will load on first conversion.';
});