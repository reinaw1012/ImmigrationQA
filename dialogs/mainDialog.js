// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, bookingDialog) {
        super('MainDialog');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;

        if (!bookingDialog) throw new Error('[MainDialog]: Missing parameter \'bookingDialog\' is required');

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(bookingDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async introStep(stepContext) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : 'Hi! What would you like to know about your visa and occupation status?';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    /**
     * Second step in the waterfall.  This will use LUIS to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the bookingDialog child dialog to collect any remaining details.
     */
    async actStep(stepContext) {
        const userinfo = {};
        const bookingDetails = {};

        if (!this.luisRecognizer.isConfigured) {
            // LUIS is not configured, we just run the BookingDialog path.
            return await stepContext.beginDialog('bookingDialog', bookingDetails);
        }

        // Call LUIS and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        console.log(LuisRecognizer.topIntent(luisResult))
        switch (LuisRecognizer.topIntent(luisResult)) {
        case 'eligibility': {
            // eslint-disable-next-line camelcase
            const visa_type = this.luisRecognizer.getVisaTypeEntities(luisResult);
            // console.log(visa_type);
            const work_type = this.luisRecognizer.getWorkTypeEntities(luisResult);
            // console.log(work_type);
            const occupation_status = this.luisRecognizer.getOccupationStatusEntities(luisResult);

            // console.log(occupation_status);
            await this.showWarningForUnsupportedCities(stepContext.context, visa_type, work_type, occupation_status);

            // Initialize BookingDetails with any entities we may have found in the response.
            userinfo.type = 'eligibility';
            userinfo.visa_type = visa_type;
            userinfo.work_type = work_type;
            userinfo.occupation_status = occupation_status;
            console.log(userinfo);
            console.log('LUIS extracted these details:', JSON.stringify(userinfo));

            // Run the BookingDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('bookingDialog', userinfo);

        }
        case 'procedure_auth': {
            // eslint-disable-next-line camelcase
            const visa_type = this.luisRecognizer.getVisaTypeEntities(luisResult);
            // console.log("HERE");
            // console.log(visa_type);

            // await this.showWarningForUnsupportedCities(stepContext.context, visa_type);

            // Initialize BookingDetails with any entities we may have found in the response.
            userinfo.visa_type = visa_type;
            userinfo.type = 'procedure_auth';
            console.log(userinfo);
            console.log('LUIS extracted these details:', JSON.stringify(userinfo));

            // Run the BookingDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('bookingDialog', userinfo);
        }
        case 'visa_information': {
            // eslint-disable-next-line camelcase
            const visa_type = this.luisRecognizer.getVisaTypeEntities(luisResult);
            const work_type = this.luisRecognizer.getWorkTypeEntities(luisResult);
            // console.log(visa_type)

            // await this.showWarningForUnsupportedCities(stepContext.context, visa_type, work_type);

            // Initialize BookingDetails with any entities we may have found in the response.
            userinfo.type = 'visa_information';
            userinfo.visa_type = visa_type;
            userinfo.work_type = work_type;
            console.log(userinfo);
            console.log('LUIS extracted these details:', JSON.stringify(userinfo));

            // Run the BookingDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('bookingDialog', userinfo);
        }

        case 'BookFlight': {
            // Extract the values for the composite entities from the LUIS result.
            const fromEntities = this.luisRecognizer.getFromEntities(luisResult);
            const toEntities = this.luisRecognizer.getToEntities(luisResult);

            // Show a warning for Origin and Destination if we can't resolve them.
            await this.showWarningForUnsupportedCities(stepContext.context, fromEntities, toEntities);

            // Initialize BookingDetails with any entities we may have found in the response.
            bookingDetails.destination = toEntities.airport;
            bookingDetails.origin = fromEntities.airport;
            bookingDetails.travelDate = this.luisRecognizer.getTravelDate(luisResult);
            console.log('LUIS extracted these booking details:', JSON.stringify(bookingDetails));

            // Run the BookingDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('bookingDialog', bookingDetails);
        }

        case 'GetWeather': {
            // We haven't implemented the GetWeatherDialog so we just display a TODO message.
            const getWeatherMessageText = 'TODO: get weather flow here';
            await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
            break;
        }

        default: {
            // Catch all for unhandled intents
            const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${ LuisRecognizer.topIntent(luisResult) })`;
            await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
        }
        }

        return await stepContext.next();
    }

    /**
     * Shows a warning if the requested From or To cities are recognized as entities but they are not in the Airport entity list.
     * In some cases LUIS will recognize the From and To composite entities as a valid cities but the From and To Airport values
     * will be empty if those entity values can't be mapped to a canonical item in the Airport.
     */
    async showWarningForUnsupportedCities(context, fromEntities, toEntities) {
        const unsupportedCities = [];
        if (fromEntities.from && !fromEntities.airport) {
            unsupportedCities.push(fromEntities.from);
        }

        if (toEntities.to && !toEntities.airport) {
            unsupportedCities.push(toEntities.to);
        }

        if (unsupportedCities.length) {
            const messageText = `Sorry but the following airports are not supported: ${ unsupportedCities.join(', ') }`;
            await context.sendActivity(messageText, messageText, InputHints.IgnoringInput);
        }
    }

    /**
     * This is the final step in the main waterfall dialog.
     * It wraps up the sample "book a flight" interaction with a simple confirmation.
     */

    messagefunc (visa_type, work_type) {
        if(visa_type =='f1'){
            if(work_type == "on campus"){
                return "On-campus employment must meet one of the following definitions: \nThe employment takes place on school premises and the employee (student) is paid by the university for the work. Examples include GSI/GSR positions or jobs at dining halls, campus libraries, etc. This is the most common type of on-campus employment. \nThe employment takes place at a commercial firm (e.g., bookstore, coffee shop) that is located on the university floor campus and provides services for students on campus. \nThe employment takes place at an off-campus location that is educationally affiliated with UC Berkeley. The affiliation must be associated with the school's established curriculum or related to contractually-funded research projects at the post-graduate level. The employment must be an integral part of the student's educational program."
            }
            else if(work_type == "cpt"){
                return "Speak to a student advisor at your university to find out more about the CPT programs available at your institution, the eligibility requirements, and potential employers. If you’re not yet an international student in the US consider going through a program like HTIR Work-Study.\nTake any college required CPT courses necessary to become an eligible candidate.\nObtain a job offer letter on official letterhead from your employer. Universities typically have a list of specific information this letter should include, like the address where work will take place.\nApply for the college-specific CPT program through your university. Note that authorization can take a few weeks, so plan ahead. Before beginning the application process make sure you have all requested documentation such as proof of class registration.\nYou will receive a document (physical or by email) approving your application and outlining your CPT start and end date. Print, sign and make a copy of this document where required.\nTalk to your employer and send relevant documentation where required.\nStart the CPT program with your employer on the outlined start date."
            }
            else if (work_type == "opt"){
                return "Confirm your 12-month OPT information is correct\nComplete and submit your STEM OPT Extension I-20 Request to ISS \nPick up New I-20 and prepare your application\nMail your application to USCIS.";
            }
        }
        else{
            return "More information regarding the " + visa_type + " work authorization rules coming soon! Thanks!"
        }
    }

    async finalStep(stepContext) {
        // If the child dialog ("bookingDialog") was cancelled or the user failed to confirm, the Result here will be null.
        if (stepContext.result) {
            const result = stepContext.result;
            // Now we have all the booking details.

            // This is where calls to the booking AOU service or database would go.

            // If the call to the booking service was successful tell the user.
            const timeProperty = new TimexProperty(result.travelDate);
            const travelDateMsg = timeProperty.toNaturalLanguage(new Date(Date.now()));
            let msg = "";
            console.log("result:",result);
            if (result["type"] == 'eligibility') {
                msg = this.messagefunc(result.visa_type.visa_type, result.work_type.work_type);
            } else if (result["type"] == "visa_information") {
                msg = this.messagefunc(result.visa_type.visa_type, result.work_type.work_type);
            } else if (result["type"] == "procedure_auth") {
                msg = this.messagefunc(result.visa_type.visa_type, result.work_type);
            } else {
                msg = "Something is wrong";
            }
            console.log(msg);
            // const msg = `I have you booked to ${ result.destination } from ${ result.origin } on ${ travelDateMsg }.`;
            await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
        }

        // Restart the main dialog with a different message the second time around
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'What else can I do for you?' });
    }
}

module.exports.MainDialog = MainDialog;
