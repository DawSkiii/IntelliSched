from flask import Blueprint, jsonify, render_template, request

login_bp = Blueprint("login",__name__)


@login_bp.route("/", methods=["GET"])
def index():
    return render_template("index.html")