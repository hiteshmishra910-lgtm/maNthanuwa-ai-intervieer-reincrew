import requests
import os
import json

def main():
    api_key = os.getenv("OPENROUTER_API_KEY", "your_openrouter_api_key_here")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Reincrew AI Locust Load Test"
    }
    
    payload = {
        "model": "deepseek/deepseek-chat",
        "messages": [{"role": "user", "content": "Return a JSON object with: { 'message': 'Hello' }"}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "max_tokens": 1000
    }
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    print("Sending request to OpenRouter...")
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {response.headers}")
    print(f"Response Text: {response.text}")

if __name__ == "__main__":
    main()
