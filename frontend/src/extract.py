import json
import sys

transcript_path = r'C:\Users\matteo\.gemini\antigravity\brain\5c0ac1ef-474a-4d0f-b9d8-20e8cac9a9d8\.system_generated\logs\transcript_full.jsonl'
target_file = 'App.jsx'

contents = {}

try:
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if data.get('type') == 'PLANNER_RESPONSE' and 'tool_calls' in data:
                    for tc in data['tool_calls']:
                        if tc['name'] == 'write_to_file' and tc['args'].get('TargetFile', '').endswith(target_file):
                            step = data.get('step_index')
                            print(f'Found write_to_file at step {step}')
                            contents[step] = tc['args'].get('CodeContent')
            except json.JSONDecodeError:
                pass

    if contents:
        last_step = max(contents.keys())
        with open('extracted_App.jsx', 'w', encoding='utf-8') as out:
            out.write(contents[last_step])
        print(f'Extracted App.jsx from step {last_step} to extracted_App.jsx')
    else:
        print('Could not find write_to_file for App.jsx')
except Exception as e:
    print(f'Error: {e}')
