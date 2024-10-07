import json
import os
import io
import logging
from scipy.signal import resample
import numpy as np
import whisper
import torch
import base64

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def convert_resample_8k(int16_array):
    normalized_arr = int16_array / 32768.0
    float_arr = normalized_arr.astype(np.float32)
    return resample(float_arr,float_arr.size*2)

def byte64_to_numpy(payload):
    payload = base64.b64decode(payload)
    return np.frombuffer(payload, dtype=np.int16)


def model_fn(model_dir):
    """
    Deserialize and return fitted model.
    """
    model = whisper.load_model(os.path.join(model_dir, 'whisper-large-v3.pt'))
    model = model.to(DEVICE)
    print(f'whisper model has been loaded to this device: {model.device.type}')
    options = whisper.DecodingOptions(language="en", without_timestamps=True, fp16 = False)
    return {'model': model, 'options': options}


def input_fn(request_body, request_content_type):
    """
    Takes in request and transforms it to necessary input type
    """
    np_array = convert_resample_8k(byte64_to_numpy(request_body))
    #np_array = np.load(io.BytesIO(request_body))
    data_input = torch.from_numpy(np_array)
    return data_input


def predict_fn(input_data, model_dict):
    """
    SageMaker model server invokes `predict_fn` on the return value of `input_fn`.

    Return predictions
    """
    audio = whisper.pad_or_trim(input_data.flatten()).to(DEVICE)
    mel = whisper.log_mel_spectrogram(audio, n_mels=128)
    output = model_dict['model'].decode(mel, model_dict['options'])
    return str(output.text)


def output_fn(predictions, content_type):
    """
    After invoking predict_fn, the model server invokes `output_fn`.
    """
    return predictions
