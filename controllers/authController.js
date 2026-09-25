const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const FcmToken = require('../models/FcmToken');
const User = require('../models/model.user');




const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// google sign in 
exports.googleSignIn = async (req, res) => {
    try {
        const { tokenId } = req.body;

        if (!tokenId) {
            return res.status(400).json({ message: 'Token ID is required' });
        }

        // 1. Verify the token with Google
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        // sub হচ্ছ Google-এর দেয়া Unique User ID, যেটাকে আমরা googleId হিসেবে নেব
        const { sub: googleId, email, name } = payload;

        // 2. Check if the user already exists in our database
        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                googleId, // এবার আর ReferenceError হবে না
                name,
                email
            });
        }

        // 3. Generate a JWT token for the user
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET
        );

        // 4. Send the token back to the client
        res.status(200).json({
            message: 'Google sign-in successful',
            userId: user._id,
            name: user.name,
            email: user.email,
            token
        });

    } catch (error) {
        console.error('Error during Google sign-in:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};














// fcm token save 

exports.updateFcmToken = async (req, res) => {


    try {

        const userId = req.user.id;
        const { token } = req.body;


        if (!token) {
            return res.status(400).json({ error: 'FCM Token is required' });
        }




        await FcmToken.findOneAndUpdate(
            { userId },
            { token: token },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(200).json({ success: true, message: 'FCM Token updated successfully' });

    } catch (error) {
        console.error('Error updating FCM token:', error);
        res.status(500).json({ error: 'Internal server error' });

    }





}











exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId).select('name email isNotificationEnabled');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }


        res.status(200).json({
            success: true,
            data: {
                name: user.name,
                email: user.email,
                isNotificationEnabled: user.isNotificationEnabled
            }
        });


    }
    catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}











exports.toggleNotification = async (req, res) => {
    try {
        const userId = req.user.id;
        const { isNotificationEnabled } = req.body;

        if (typeof isNotificationEnabled !== 'boolean') {
            return res.status(400).json({ success: false, message: 'isNotificationEnabled (boolean) is required' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isNotificationEnabled },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: `Notification ${isNotificationEnabled ? 'enabled' : 'disabled'} successfully`,
            isNotificationEnabled: updatedUser.isNotificationEnabled
        });

    } catch (error) {
        console.error('Error updating notification status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};