import json
import sys

filepath = r'C:\Users\user\.claude\projects\C--Users-user-OneDrive-------beancraft\069360be-6f36-4733-b5d2-89354d03f112.jsonl'
outpath = r'C:\Users\user\OneDrive\바탕 화면\beancraft\feb25_human_full.txt'

# First pass: collect all user messages
user_messages = []

with open(filepath, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if '2026-02-25' not in line:
            continue
        try:
            obj = json.loads(line.strip())
            if obj.get('type') == 'user':
                msg = obj.get('message', {})
                content = msg.get('content', '')
                ts = obj.get('timestamp', '')
                uuid = obj.get('uuid', '')
                parent = obj.get('parentUuid', '')

                if isinstance(content, list):
                    text_parts = []
                    for item in content:
                        if isinstance(item, dict):
                            if item.get('type') == 'text':
                                text_parts.append(item.get('text', ''))
                            elif item.get('type') == 'image':
                                text_parts.append('[IMAGE]')
                            elif item.get('type') == 'tool_result':
                                pass
                            else:
                                text_parts.append('[' + item.get('type', 'unknown') + ']')
                    content_str = '\n'.join(text_parts)
                else:
                    content_str = str(content)

                if content_str.strip():
                    user_messages.append({
                        'line': i,
                        'timestamp': ts,
                        'content': content_str,
                        'uuid': uuid,
                        'parent': parent
                    })
        except:
            pass

# Second pass: collect assistant messages
all_assistant_msgs = []

with open(filepath, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if '2026-02-25' not in line:
            continue
        try:
            obj = json.loads(line.strip())
            if obj.get('type') == 'assistant':
                msg = obj.get('message', {})
                content = msg.get('content', [])
                ts = obj.get('timestamp', '')
                parent = obj.get('parentUuid', '')

                text_parts = []
                tool_uses = []

                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict):
                            if item.get('type') == 'text':
                                t = item.get('text', '')
                                if t.strip():
                                    text_parts.append(t)
                            elif item.get('type') == 'tool_use':
                                tool_name = item.get('name', '')
                                tool_input = item.get('input', {})
                                if tool_name == 'Edit':
                                    fp = tool_input.get('file_path', '')
                                    tool_uses.append('Edit: ' + fp)
                                elif tool_name == 'Bash':
                                    cmd = tool_input.get('command', '')[:200]
                                    tool_uses.append('Bash: ' + cmd)
                                elif tool_name == 'Read':
                                    fp = tool_input.get('file_path', '')
                                    tool_uses.append('Read: ' + fp)
                                elif tool_name == 'Write':
                                    fp = tool_input.get('file_path', '')
                                    tool_uses.append('Write: ' + fp)
                                elif tool_name == 'Grep':
                                    pat = tool_input.get('pattern', '')[:100]
                                    tool_uses.append('Grep: "' + pat + '"')
                                elif tool_name == 'Glob':
                                    pat = tool_input.get('pattern', '')
                                    tool_uses.append('Glob: ' + pat)
                                elif 'Chrome' in tool_name:
                                    action = tool_input.get('action', '')
                                    url = tool_input.get('url', '')
                                    short_name = tool_name.split('__')[-1]
                                    detail = action or url or ''
                                    tool_uses.append('Chrome/' + short_name + ': ' + detail[:100])
                                elif 'Preview' in tool_name:
                                    short_name = tool_name.split('__')[-1]
                                    tool_uses.append('Preview/' + short_name)
                                else:
                                    tool_uses.append(tool_name)
                elif isinstance(content, str):
                    if content.strip():
                        text_parts.append(content)

                all_assistant_msgs.append({
                    'line': i,
                    'timestamp': ts,
                    'parent': parent,
                    'text': text_parts,
                    'tools': tool_uses
                })
        except:
            pass

# Write output
with open(outpath, 'w', encoding='utf-8') as out:
    out.write('=' * 100 + '\n')
    out.write('2026-02-25 전체 대화 분석 (Human 메시지 전문 + Assistant 작업 요약)\n')
    out.write('총 Human 메시지: ' + str(len(user_messages)) + '개\n')
    out.write('=' * 100 + '\n\n')

    for idx, um in enumerate(user_messages):
        out.write('\n' + '#' * 100 + '\n')
        out.write('## Human #' + str(idx+1) + ' | ' + um['timestamp'] + ' | Line ' + str(um['line']) + '\n')
        out.write('#' * 100 + '\n\n')
        out.write(um['content'])
        out.write('\n\n')

        # Find assistant responses that are children of this user message
        responding = [a for a in all_assistant_msgs if a['parent'] == um['uuid']]

        if responding:
            out.write('--- Assistant 응답 (' + str(len(responding)) + '개 메시지) ---\n')
            for a in responding:
                if a['text']:
                    for t in a['text']:
                        if len(t) > 1000:
                            out.write('  [텍스트] ' + t[:1000] + '...(truncated)\n')
                        else:
                            out.write('  [텍스트] ' + t + '\n')
                if a['tools']:
                    out.write('  [도구 사용]\n')
                    for tool in a['tools']:
                        out.write('    ' + tool + '\n')
            out.write('\n')
        else:
            # Try to find the next assistant message by line proximity
            next_assistants = [a for a in all_assistant_msgs if a['line'] > um['line'] and a['line'] < um['line'] + 50]
            if next_assistants:
                out.write('--- Assistant 응답 (근접 ' + str(len(next_assistants)) + '개) ---\n')
                for a in next_assistants[:3]:
                    if a['text']:
                        for t in a['text']:
                            if len(t) > 1000:
                                out.write('  [텍스트] ' + t[:1000] + '...(truncated)\n')
                            else:
                                out.write('  [텍스트] ' + t + '\n')
                    if a['tools']:
                        out.write('  [도구 사용]\n')
                        for tool in a['tools']:
                            out.write('    ' + tool + '\n')
                out.write('\n')
            else:
                out.write('--- Assistant 응답: (직접 자식 없음) ---\n\n')

print('Done. ' + str(len(user_messages)) + ' human messages written.')
