from flask import Flask, jsonify, request
from services.analyzer import analyze_attempts

app = Flask(__name__)


@app.get('/health')
def health_check():
    return jsonify({'status': 'ok', 'message': 'ML service is running'})


@app.post('/analyze')
def analyze():
    payload = request.get_json(silent=True) or {}
    attempts = payload.get('attempts', [])

    if not isinstance(attempts, list):
        return jsonify({'message': 'attempts must be an array'}), 400

    result = analyze_attempts(attempts)
    return jsonify(result)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
