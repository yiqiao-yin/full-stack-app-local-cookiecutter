import json
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
table = dynamodb.Table("cookiecutter-test-table-v1")


def lambda_handler(event, context):
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    body = json.loads(event.get("body") or "{}")

    try:
        # POST /register — create user
        if http_method == "POST" and path == "/register":
            username = body.get("username")
            hashed_password = body.get("hashed_password")
            created_at = body.get("created_at")
            if not username or not hashed_password:
                return _response(400, {"error": "username and hashed_password required"})
            table.put_item(
                Item={
                    "username": username,
                    "hashed_password": hashed_password,
                    "created_at": created_at or "",
                },
                ConditionExpression="attribute_not_exists(username)",
            )
            return _response(201, {"message": "user created"})

        # POST /login — get user for verification
        if http_method == "POST" and path == "/login":
            username = body.get("username")
            if not username:
                return _response(400, {"error": "username required"})
            result = table.get_item(Key={"username": username})
            item = result.get("Item")
            if not item:
                return _response(404, {"error": "user not found"})
            return _response(200, {
                "username": item["username"],
                "hashed_password": item["hashed_password"],
                "created_at": item.get("created_at", ""),
            })

        # GET /user/{username}
        if http_method == "GET" and path.startswith("/user/"):
            username = path.split("/user/", 1)[1]
            result = table.get_item(Key={"username": username})
            item = result.get("Item")
            if not item:
                return _response(404, {"error": "user not found"})
            return _response(200, {
                "username": item["username"],
                "hashed_password": item["hashed_password"],
                "created_at": item.get("created_at", ""),
            })

        # DELETE /user/{username}
        if http_method == "DELETE" and path.startswith("/user/"):
            username = path.split("/user/", 1)[1]
            table.delete_item(Key={"username": username})
            return _response(200, {"message": "user deleted"})

        return _response(400, {"error": "unsupported route"})

    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _response(409, {"error": "username already exists"})
        return _response(500, {"error": str(e)})


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
