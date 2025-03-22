user-username = Username
user-displayname = Display Name
user-id = User ID

user-permissions = Permissions
    .moderator = Moderator
    .administrator = Administrator

    .list-helper = List Helper
    .list-moderator = List Moderator
    .list-administrator = List Administrator

## Auth input fields
auth-username = Username
auth-password = Password
auth-repeatpassword = Repeat Password

## Login/registration forms
#
# The .redirect-link attributes will be turned into
# clickable link, which will replace {$redirect-link}
# in the .redirect attributes
#
login = Sign In
    .info = Sign in using your username and password. Sign in attempts are limited to 3 per 30 minutes.
    .submit = Sign In

    .redirect = Already have a pointercrate account? {$redirect-link} instead.
    .redirect-link = Sign in

register = Sign Up
    .info = Create a new account. Please note that the username cannot be changed after account creation, so choose wisely!
    .submit = Sign Up

    .redirect = Don't have a pointercrate account yet? {$redirect-link} for one!
    .redirect-link = Sign up

## Users tab
users = Users

user-viewer = Pointercrate Account Manager
    .welcome = Click on a user on the left to get started!
    .delete-user = Delete user
    .edit-user = Edit user

user-idsearch-panel = Find users
    .info = Users can be uniquely identified by name and ID. To modify a user's account, you need their ID. If you know neither, try looking in the list below
    .id-field = User ID
    .submit = Find by ID

## Profile tab
profile = Profile
    .header = Profile - {$username}

profile-username = Username
    .info = The name you registered under and which you use to log in to pointercrate. This name is unique to your account, and cannot be changed.

profile-display-name = Display name
    .info = If set, this name will be displayed instead of your username. Display names aren't unique and you cannot use your display name to login to your pointercrate account.

    .dialog-header = Edit Display Name
    .dialog-newname = New display name
    .dialog-submit = Edit

profile-youtube = YouTube channel
    .info = A link to your YouTube channel, if you have one. If set, all mentions of your name will turn into links to it.

    .dialog-header = Edit YouTube Channel Link
    .dialog-newlink = New YouTube link
    .dialog-submit = Edit

profile-permissions = Permissions
    .info = The permissions you have on pointercrate. 'List ...' means you're a member of the demonlist team. 'Moderator' and 'Administrator' mean you're part of pointercrate's staff team.

profile-delete-account = Delete My Account
    .dialog-header = Delete Account
    .dialog-info = Deletion of your account is irreversible!
    .dialog-submit = Delete

profile-change-password = Change Password
    .dialog-header = Change Password
    .dialog-info = To make profile related edits, re-entering your password below is required. Changing your password will log you out and redirect to the login page. It will further invalidate all access tokens to your account.

    .dialog-newpassword = New password
    .dialog-repeatnewpassword = Repeat new password
    .dialog-authenticate = Authenticate

    .dialog-submit = Edit

profile-logout = Logout
    .info = Log out of your pointercrate account in this browser.
    .button = Logout

profile-get-token = Get access token
    .info = Your pointercrate access token allows you, or programs authorized by you, to make API calls on your behalf. They do not allow modifications of your account however.
    .button = Get access token

    .view-header = Your access token is

profile-invalidate-tokens = Invalidate tokens
    .info = If one of your access tokens ever got leaked, you can invalidate them here. Invalidating will cause all access tokens to your account to stop functioning. This includes the one stored inside the browser currently, meaning you'll have to log in again after this action!
    .button = Invalidate all access tokens
