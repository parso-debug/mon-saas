class LlmChat:
    def __init__(self, *a, **k):
        pass
    async def send_message(self, *a, **k):
        return "ok"

class UserMessage:
    def __init__(self, t=""):
        self.text = t